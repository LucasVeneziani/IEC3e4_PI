"""Sobe o backend com um único comando: `python run.py` (Windows, Mac ou Linux).

Na primeira vez cria o ambiente virtual, instala as dependências, cria o app_secrets.py (pedindo a chave da OpenRouter)
e grava o IP deste computador no .env do app. Nas próximas vezes só inicia o servidor.
Só usa a biblioteca padrão, então funciona com qualquer Python 3.10+.
"""

from __future__ import annotations

import hashlib
import os
import re
import socket
import subprocess
import sys
import venv
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
APP_ROOT = BACKEND.parent
VENV = BACKEND / ".venv"
REQUIREMENTS = BACKEND / "requirements.txt"
STAMP = VENV / ".requirements.sha256"
PORT = int(os.getenv("PORT", "8000"))


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def ensure_venv() -> None:
    if not venv_python().exists():
        print("» Criando ambiente virtual (.venv)...")
        venv.EnvBuilder(with_pip=True).create(VENV)

    # Reinstala só quando o requirements.txt muda.
    digest = hashlib.sha256(REQUIREMENTS.read_bytes()).hexdigest()
    if STAMP.exists() and STAMP.read_text().strip() == digest:
        return
    print("» Instalando dependências...")
    subprocess.check_call([str(venv_python()), "-m", "pip", "install", "-q", "--upgrade", "pip"])
    subprocess.check_call([str(venv_python()), "-m", "pip", "install", "-q", "-r", str(REQUIREMENTS)])
    STAMP.write_text(digest)


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
    return values


def set_env_value(path: Path, key: str, value: str) -> None:
    """Troca (ou adiciona) KEY=valor mantendo o resto do arquivo e os comentários."""
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    for i, line in enumerate(lines):
        if line.split("=", 1)[0].strip() == key and not line.lstrip().startswith("#"):
            lines[i] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def ensure_secrets() -> None:
    """Cria o app_secrets.py (fora do git) a partir do modelo e pede a chave da OpenRouter se estiver vazia."""
    secrets_file = BACKEND / "app_secrets.py"
    if not secrets_file.exists():
        secrets_file.write_text((BACKEND / "app_secrets.example.py").read_text(encoding="utf-8"), encoding="utf-8")
        print("» Criado backend/app_secrets.py")

    text = secrets_file.read_text(encoding="utf-8")
    values: dict = {}
    exec(compile(text, str(secrets_file), "exec"), values)
    if values.get("OPENROUTER_API_KEY") or values.get("DEMO_MODE"):
        return
    print("\nFalta a chave da OpenRouter (crie uma em https://openrouter.ai/keys).")
    key = input("Cole a chave aqui (ou Enter para usar o modo demonstração): ").strip()
    if key:
        text = re.sub(r"^OPENROUTER_API_KEY\s*=.*$", f"OPENROUTER_API_KEY = {key!r}", text, count=1, flags=re.MULTILINE)
    else:
        text = re.sub(r"^DEMO_MODE\s*=.*$", "DEMO_MODE = True", text, count=1, flags=re.MULTILINE)
        print("» Modo demonstração ativado: os escaneamentos vão devolver um resultado de exemplo.")
    secrets_file.write_text(text, encoding="utf-8")


def lan_ip() -> str:
    # Não envia nada: só pergunta ao sistema qual interface seria usada para sair para a rede.
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def point_app_to_backend(ip: str) -> None:
    """Grava EXPO_PUBLIC_API_URL no .env do app para o celular achar este computador."""
    app_env = APP_ROOT / ".env"
    url = f"http://{ip}:{PORT}"
    if not app_env.exists() and (APP_ROOT / ".env.example").exists():
        app_env.write_text((APP_ROOT / ".env.example").read_text(encoding="utf-8"), encoding="utf-8")
    if read_env(app_env).get("EXPO_PUBLIC_API_URL") != url:
        set_env_value(app_env, "EXPO_PUBLIC_API_URL", url)
        print(f"» .env do app atualizado: EXPO_PUBLIC_API_URL={url}")
        print("  (se o `npx expo start` já estava rodando, reinicie-o para pegar o novo endereço)")


def main() -> None:
    os.chdir(BACKEND)
    ensure_venv()
    ensure_secrets()
    ip = lan_ip()
    point_app_to_backend(ip)
    print(f"\n✔ Backend em http://{ip}:{PORT}  (Ctrl+C para parar)\n")
    try:
        subprocess.call([str(venv_python()), "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(PORT)])
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    if sys.version_info < (3, 10):
        sys.exit("É preciso Python 3.10 ou mais novo.")
    main()
