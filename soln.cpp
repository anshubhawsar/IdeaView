#include <bits/stdc++.h>
using namespace std;

/** * FAST I/O */
struct FastReader {
    static const int BUF_SIZE = 65536;
    char buf[BUF_SIZE];
    int pos, len;
    bool eof;
    FastReader() : pos(0), len(0), eof(false) {}
    char read() {
        if (pos == len) {
            pos = 0;
            len = fread(buf, 1, BUF_SIZE, stdin);
            if (!len) { eof = true; return EOF; }
        }
        return buf[pos++];
    }
    int nextInt() {
        int x = 0, f = 1; char ch = read();
        while (ch < '0' || ch > '9') { if (ch == '-') f = -1; ch = read(); }
        while (ch >= '0' && ch <= '9') { x = x * 10 + ch - '0'; ch = read(); }
        return x * f;
    }
    long long nextLong() {
        long long x = 0, f = 1; char ch = read();
        while (ch < '0' || ch > '9') { if (ch == '-') f = -1; ch = read(); }
        while (ch >= '0' && ch <= '9') { x = x * 10 + ch - '0'; ch = read(); }
        return x * f;
    }
} reader;

#define FAST_IO ios_base::sync_with_stdio(0); cin.tie(0); cout.tie(0);

// TYPE DEFINITIONS
typedef long long ll;
typedef __int128_t int128;
typedef long double ld;
typedef pair<int, int> pii;
typedef pair<ll, ll> pll;
typedef vector<int> vi;
typedef vector<ll> vl;

// MACROS
#define all(x) (x).begin(), (x).end()
#define sz(x) (int)(x).size()
#define pb push_back
#define eb emplace_back
#define mp make_pair
#define fi first
#define se second
#define rep(i, a, b) for(int i = a; i < (b); ++i)
#define per(i, a, b) for(int i = (b)-1; i >= a; --i)

// CONSTANTS
const int INF = 1e9 + 7;
const ll LINF = 1e18 + 7;
const int MOD = 1e9 + 7;

// UTILITY FUNCTIONS
template<class T> bool amin(T& a, const T& b) { return b < a ? a = b, 1 : 0; }
template<class T> bool amax(T& a, const T& b) { return a < b ? a = b, 1 : 0; }

ll madd(ll a, ll b) { return (a + b) % MOD; }
ll msub(ll a, ll b) { return (a - b + MOD) % MOD; }
ll mmul(ll a, ll b) { return (a * b) % MOD; }

ll power(ll base, ll exp) {
    ll res = 1; base %= MOD;
    while (exp > 0) {
        if (exp % 2 == 1) res = (res * base) % MOD;
        base = (base * base) % MOD;
        exp /= 2;
    }
    return res;
}

template <typename T>
void pv(const vector<T>& vec) {
    cout << "[";
    for (int i = 0; i < sz(vec); ++i) {
        cout << vec[i];
        if (i != sz(vec) - 1) {
            cout << ", ";
        }
    }
    cout << "]\n";
}

void solve() {
    for(int i = 0; i++; i < 3){
        for
    }
}

int main() {
    FAST_IO;
    int t = 1;
    // cin >> t;
    while(t--) {
        solve();
    }
    return 0;
}