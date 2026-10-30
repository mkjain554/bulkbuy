import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { request } from './src/api';
import type { Participation, Pool, User } from './src/types';

type Screen = 'browse' | 'joined' | 'account';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [joined, setJoined] = useState<Participation[]>([]);
  const [selected, setSelected] = useState<Pool | null>(null);
  const [screen, setScreen] = useState<Screen>('browse');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'BUYER' | 'SELLER'>('BUYER');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const result = await request<{ pools: Pool[] }>('/pools?pageSize=30');
      setPools(result.pools);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not load offers.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshJoined = useCallback(async () => {
    if (user?.role !== 'BUYER') return;
    try {
      const result = await request<{ participations: Participation[] }>(
        '/users/me/participations',
      );
      setJoined(result.participations);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not load joined pools.',
      );
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    request<{ user: User }>('/auth/me')
      .then(({ user: current }) => setUser(current))
      .catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    void refreshJoined();
  }, [refreshJoined]);

  async function submitAuth(credentials: {
    name: string;
    email: string;
    password: string;
  }) {
    setBusy(true);
    setError('');
    try {
      const result = await request<{ user: User }>(
        authMode === 'login' ? '/auth/login' : '/auth/register',
        {
          method: 'POST',
          body:
            authMode === 'login'
              ? { email: credentials.email, password: credentials.password }
              : { ...credentials, role },
        },
      );
      setUser(result.user);
      setNotice(`Welcome, ${result.user.name}.`);
      setScreen(result.user.role === 'SELLER' ? 'account' : 'browse');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function joinPool() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await request(`/pools/${selected.id}/join`, {
        method: 'POST',
        body: { responses },
      });
      setSelected(null);
      setResponses({});
      setNotice('You joined the pool. No payment was collected.');
      await Promise.all([refresh(), refreshJoined()]);
      setScreen('joined');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not join this offer.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await request('/auth/logout', { method: 'POST' });
      setUser(null);
      setNotice('You have signed out.');
      setScreen('browse');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not sign out.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>BulkBuy</Text>
        <Text style={styles.headerCaption}>GROUP BUYING, TOGETHER</Text>
      </View>
      <View style={styles.tabs}>
        <Tab
          label="Discover"
          active={screen === 'browse'}
          onPress={() => setScreen('browse')}
        />
        <Tab
          label="My group buys"
          active={screen === 'joined'}
          onPress={() => setScreen('joined')}
        />
        <Tab
          label={user ? 'Account' : 'Sign in'}
          active={screen === 'account'}
          onPress={() => setScreen('account')}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {notice ? (
          <Pressable onPress={() => setNotice('')} style={styles.notice}>
            <Text style={styles.noticeText}>{notice} ×</Text>
          </Pressable>
        ) : null}
        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {selected ? (
          <PoolDetails
            pool={selected}
            user={user}
            responses={responses}
            setResponses={setResponses}
            onJoin={() => void joinPool()}
            onBack={() => setSelected(null)}
            onSignIn={() => setScreen('account')}
            busy={busy}
          />
        ) : screen === 'browse' ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>BUY TOGETHER. SAVE TOGETHER.</Text>
              <Text style={styles.heroTitle}>
                Better deals, built together.
              </Text>
              <Text style={styles.heroText}>
                Join a group offer and help unlock a seller-advertised price.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Open group offers</Text>
            {loading ? (
              <ActivityIndicator color="#4338ca" style={styles.loader} />
            ) : pools.length === 0 ? (
              <Text style={styles.empty}>
                No active offers right now. Check back soon.
              </Text>
            ) : (
              pools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  onPress={() => setSelected(pool)}
                />
              ))
            )}
          </>
        ) : screen === 'joined' ? (
          <View>
            <Text style={styles.sectionTitle}>Your group buys</Text>
            {!user ? (
              <Text style={styles.empty}>
                Sign in as a buyer to see the pools you have joined.
              </Text>
            ) : joined.length === 0 ? (
              <Text style={styles.empty}>
                You have not joined any pools yet.
              </Text>
            ) : (
              joined.map((item) => (
                <PoolCard
                  key={item.id}
                  pool={item.pool}
                  onPress={() => setSelected(item.pool)}
                />
              ))
            )}
          </View>
        ) : user ? (
          <View style={styles.accountCard}>
            <Text style={styles.eyebrow}>ACCOUNT</Text>
            <Text style={styles.sectionTitle}>{user.name}</Text>
            <Text style={styles.bodyText}>{user.email}</Text>
            <Text style={styles.roleBadge}>{user.role.toLowerCase()}</Text>
            {user.role === 'SELLER' ? (
              <Text style={styles.bodyText}>
                Use the seller workspace on the web app to create products and
                configure pool forms. Your seller account and offers use the
                same BulkBuy API.
              </Text>
            ) : null}
            <Button label="Sign out" onPress={() => void signOut()} secondary />
          </View>
        ) : (
          <View style={styles.accountCard}>
            <Text style={styles.eyebrow}>WELCOME TO BULKBUY</Text>
            <Text style={styles.sectionTitle}>
              {authMode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
            <AuthForm
              mode={authMode}
              role={role}
              setRole={setRole}
              busy={busy}
              onSubmit={submitAuth}
            />
            <Pressable
              onPress={() => {
                setError('');
                setAuthMode(authMode === 'login' ? 'register' : 'login');
              }}
            >
              <Text style={styles.switchAuth}>
                {authMode === 'login'
                  ? 'New to BulkBuy? Create an account'
                  : 'Have an account? Sign in'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PoolCard({ pool, onPress }: { pool: Pool; onPress: () => void }) {
  const progress = Math.min(
    100,
    Math.round((pool._count.participations / pool.minBuyers) * 100),
  );
  return (
    <Pressable onPress={onPress} style={styles.poolCard}>
      <View style={styles.row}>
        <Text style={styles.brandLabel}>
          {pool.product.brand.toUpperCase()}
        </Text>
        <Text
          style={
            pool.status === 'ACTIVE' ? styles.activeBadge : styles.statusBadge
          }
        >
          {pool.status.replaceAll('_', ' ').toLowerCase()}
        </Text>
      </View>
      <Text style={styles.poolName}>{pool.product.name}</Text>
      <Text style={styles.poolTitle}>{pool.title}</Text>
      <View style={[styles.row, { marginTop: 16 }]}>
        <View>
          <Text style={styles.caption}>Advertised group price</Text>
          <Text style={styles.price}>{formatMoney(pool.groupPrice)}</Text>
        </View>
        <Text style={styles.caption}>
          {pool._count.participations} / {pool.minBuyers} joined
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.caption}>
        Closes {new Date(pool.closesAt).toLocaleDateString()}
      </Text>
    </Pressable>
  );
}

function PoolDetails({
  pool,
  user,
  responses,
  setResponses,
  onJoin,
  onBack,
  onSignIn,
  busy,
}: {
  pool: Pool;
  user: User | null;
  responses: Record<string, string>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onJoin: () => void;
  onBack: () => void;
  onSignIn: () => void;
  busy: boolean;
}) {
  return (
    <View>
      <Button label="← Back to offers" onPress={onBack} secondary />
      <View style={styles.detailCard}>
        <Text style={styles.brandLabel}>
          {pool.product.brand} · {pool.product.category.name}
        </Text>
        <Text style={styles.sectionTitle}>{pool.product.name}</Text>
        <Text style={styles.poolTitle}>{pool.title}</Text>
        <Text style={styles.price}>
          {formatMoney(pool.groupPrice)} advertised
        </Text>
        <Text style={styles.bodyText}>
          Regular price {formatMoney(pool.regularPrice)}
        </Text>
        <Text style={styles.bodyText}>
          {pool._count.participations} participants · {pool.minBuyers} needed
        </Text>
        <Text style={styles.caption}>
          Closes {new Date(pool.closesAt).toLocaleString()}
        </Text>
        <Text style={[styles.bodyText, { marginTop: 12 }]}>
          {pool.description}
        </Text>
        <Text style={styles.formHeading}>Product details</Text>
        <Text style={styles.bodyText}>
          {pool.product.name} · {pool.product.brand}
        </Text>
        <Text style={styles.bodyText}>{pool.product.description}</Text>
        {user?.role === 'BUYER' && pool.status === 'ACTIVE' ? (
          <>
            {pool.formFields.map((field) => (
              <View key={field.id} style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </Text>
                {field.type === 'DROPDOWN' ? (
                  <View style={styles.options}>
                    {(field.config.options ?? []).map((option) => (
                      <Pressable
                        key={option}
                        onPress={() =>
                          setResponses((current) => ({
                            ...current,
                            [field.id]: option,
                          }))
                        }
                        style={[
                          styles.option,
                          responses[field.id] === option &&
                            styles.optionSelected,
                        ]}
                      >
                        <Text
                          style={
                            responses[field.id] === option
                              ? styles.optionTextSelected
                              : styles.optionText
                          }
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={responses[field.id] ?? ''}
                    onChangeText={(text) =>
                      setResponses((current) => ({
                        ...current,
                        [field.id]: text,
                      }))
                    }
                    placeholder={
                      field.config.placeholder ??
                      (field.type === 'DATE' ? 'YYYY-MM-DD' : 'Your answer')
                    }
                    keyboardType={
                      field.type === 'DATE'
                        ? 'numbers-and-punctuation'
                        : 'default'
                    }
                    style={styles.input}
                  />
                )}
              </View>
            ))}
            <Text style={styles.caption}>
              Free to join. No payment is collected. Final terms are confirmed
              by the seller.
            </Text>
            <Button
              label={busy ? 'Joining…' : 'Join this pool'}
              onPress={onJoin}
              disabled={busy}
            />
          </>
        ) : user ? (
          <Text style={styles.empty}>
            This pool is not accepting participants, or your account is not a
            buyer account.
          </Text>
        ) : (
          <Button label="Sign in to join" onPress={onSignIn} />
        )}
      </View>
    </View>
  );
}

function AuthForm({
  mode,
  role,
  setRole,
  busy,
  onSubmit,
}: {
  mode: 'login' | 'register';
  role: 'BUYER' | 'SELLER';
  setRole: (role: 'BUYER' | 'SELLER') => void;
  busy: boolean;
  onSubmit: (credentials: {
    name: string;
    email: string;
    password: string;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View>
      {mode === 'register' ? (
        <>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            style={styles.input}
          />
          <View style={styles.options}>
            {(['BUYER', 'SELLER'] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setRole(value)}
                style={[styles.option, role === value && styles.optionSelected]}
              >
                <Text
                  style={
                    role === value
                      ? styles.optionTextSelected
                      : styles.optionText
                  }
                >
                  {value === 'BUYER' ? 'Buyer' : 'Seller'}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password (12+ characters)"
        secureTextEntry
        style={styles.input}
      />
      <Button
        label={
          busy
            ? 'Please wait…'
            : mode === 'login'
              ? 'Sign in'
              : 'Create account'
        }
        onPress={() => onSubmit({ name, email, password })}
        disabled={busy}
      />
    </View>
  );
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={active ? styles.tabTextActive : styles.tabText}>
        {label}
      </Text>
    </Pressable>
  );
}

function Button({
  label,
  onPress,
  disabled,
  secondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={secondary ? styles.buttonTextSecondary : styles.buttonText}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatMoney(value: number | string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#fff',
  },
  brand: { color: '#4338ca', fontSize: 24, fontWeight: '800' },
  headerCaption: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#4338ca' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#4338ca', fontSize: 12, fontWeight: '700' },
  content: { padding: 18, paddingBottom: 40 },
  hero: {
    borderRadius: 22,
    backgroundColor: '#1e1b4b',
    padding: 22,
    marginBottom: 24,
  },
  eyebrow: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 9,
  },
  heroTitle: { color: '#fff', fontSize: 29, fontWeight: '800', lineHeight: 34 },
  heroText: { color: '#c7d2fe', fontSize: 14, lineHeight: 21, marginTop: 10 },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 23,
    fontWeight: '800',
    marginBottom: 12,
  },
  loader: { marginVertical: 40 },
  empty: {
    color: '#64748b',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  poolCard: {
    backgroundColor: '#fff',
    borderRadius: 17,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandLabel: {
    color: '#4338ca',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activeBadge: {
    color: '#047857',
    backgroundColor: '#ecfdf5',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    color: '#4338ca',
    backgroundColor: '#eef2ff',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '700',
  },
  poolName: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginTop: 9 },
  poolTitle: { color: '#64748b', fontSize: 13, marginTop: 3 },
  caption: { color: '#64748b', fontSize: 11, marginTop: 5 },
  price: { color: '#0f172a', fontSize: 22, fontWeight: '800', marginTop: 4 },
  progressTrack: {
    height: 7,
    backgroundColor: '#e2e8f0',
    borderRadius: 9,
    marginTop: 11,
    marginBottom: 7,
  },
  progressBar: { height: 7, backgroundColor: '#4f46e5', borderRadius: 9 },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  bodyText: { color: '#475569', fontSize: 14, lineHeight: 21, marginTop: 7 },
  roleBadge: {
    alignSelf: 'flex-start',
    color: '#4338ca',
    backgroundColor: '#eef2ff',
    overflow: 'hidden',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 99,
    marginTop: 12,
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fff',
    color: '#0f172a',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#4338ca',
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 11,
    marginTop: 14,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  buttonTextSecondary: { color: '#334155', fontSize: 14, fontWeight: '700' },
  switchAuth: {
    color: '#4338ca',
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 17,
  },
  notice: {
    backgroundColor: '#eef2ff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  noticeText: { color: '#3730a3', fontSize: 13 },
  error: {
    backgroundColor: '#fff1f2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: { color: '#be123c', fontSize: 13 },
  detailCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12,
  },
  formHeading: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 6,
  },
  field: { marginTop: 14 },
  fieldLabel: { color: '#334155', fontSize: 13, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  option: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  optionSelected: { backgroundColor: '#4338ca', borderColor: '#4338ca' },
  optionText: { color: '#334155', fontSize: 12 },
  optionTextSelected: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
