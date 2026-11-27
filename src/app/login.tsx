import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { loginColors as c } from '@/lib/theme';
import { EMAIL_REGEX, PASSWORD_RULES, STRONG_PASSWORD_REGEX, USERNAME_REGEX } from '@/lib/validation';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ username: false, email: false, password: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';
  const usernameOk = isRegister ? USERNAME_REGEX.test(username.trim()) : username.trim().length > 0;
  const emailOk = EMAIL_REGEX.test(email.trim());
  const passwordOk = isRegister ? STRONG_PASSWORD_REGEX.test(password) : password.length > 0;
  const canSubmit = usernameOk && passwordOk && (!isRegister || emailOk) && !busy;

  async function submit() {
    setTouched({ username: true, email: true, password: true });
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await register(username, email, password);
      else await login(username, password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
    setTouched({ username: false, email: false, password: false });
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Ionicons name="shirt-outline" size={44} color={c.accent} />
          </View>
          <Text style={styles.title}>AppBrechó</Text>
          <Text style={styles.subtitle}>{isRegister ? 'Crie sua conta' : 'Entre na sua conta'}</Text>

          <Field
            label={isRegister ? 'Usuário' : 'Usuário ou e-mail'}
            icon="person-outline"
            value={username}
            onChangeText={setUsername}
            onBlur={() => setTouched((t) => ({ ...t, username: true }))}
            error={touched.username && !usernameOk ? (isRegister ? '3 a 20 caracteres: letras, números, "." ou "_"' : 'Informe seu usuário') : null}
            autoComplete="username"
          />

          {isRegister && (
            <Field
              label="E-mail"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              error={touched.email && !emailOk ? 'E-mail inválido' : null}
              keyboardType="email-address"
              autoComplete="email"
            />
          )}

          <Field
            label="Senha"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={touched.password && !passwordOk ? (isRegister ? 'Senha fraca' : 'Informe sua senha') : null}
            secureTextEntry={!showPassword}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            right={
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10} accessibilityLabel="Mostrar senha">
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
              </Pressable>
            }
          />

          {isRegister && (
            <View style={styles.rules}>
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                  <View key={rule.label} style={styles.ruleRow}>
                    <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={ok ? c.ok : c.muted} />
                    <Text style={[styles.ruleText, ok && { color: c.ok }]}>{rule.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={submit}
            style={({ pressed }) => [styles.button, (!canSubmit || pressed) && { opacity: canSubmit ? 0.85 : 0.5 }]}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#14202F" /> : <Text style={styles.buttonText}>{isRegister ? 'Cadastrar' : 'Entrar'}</Text>}
          </Pressable>

          <Pressable onPress={switchMode} style={styles.switch} hitSlop={8}>
            <Text style={styles.switchText}>
              {isRegister ? 'Já tem conta? ' : 'Não tem conta? '}
              <Text style={{ color: c.accent, fontWeight: '600' }}>{isRegister ? 'Entrar' : 'Cadastre-se'}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  error: string | null;
  right?: React.ReactNode;
};

function Field({ label, icon, error, right, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? { borderColor: c.danger } : null]}>
        <Ionicons name={icon} size={18} color={c.muted} />
        <TextInput
          style={styles.input}
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          {...input}
        />
        {right}
      </View>
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: c.field,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: c.text, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: c.muted, fontSize: 15, textAlign: 'center', marginTop: 4, marginBottom: 28 },
  field: { marginBottom: 16 },
  label: { color: c.muted, fontSize: 13, marginBottom: 6, fontWeight: '500' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.field,
    borderWidth: 1,
    borderColor: c.fieldBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  input: { flex: 1, color: c.text, fontSize: 16, height: '100%' },
  fieldError: { color: c.danger, fontSize: 12, marginTop: 4 },
  rules: { marginTop: -4, marginBottom: 12, gap: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { color: c.muted, fontSize: 12 },
  error: { color: c.danger, textAlign: 'center', marginBottom: 12 },
  button: {
    backgroundColor: c.accent,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#14202F', fontSize: 16, fontWeight: '700' },
  switch: { marginTop: 20, alignSelf: 'center' },
  switchText: { color: c.muted, fontSize: 14 },
});
