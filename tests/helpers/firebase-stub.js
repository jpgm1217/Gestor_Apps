function firebaseStub() {
  window.__copiedText = '';
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText(text) {
        window.__copiedText = String(text);
        return Promise.resolve();
      }
    }
  });

  const listeners = [];
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  let transactionDelay = 0;
  let failAfterCommit = 0;
  let failReads = 0;
  let storedData = (() => {
    try {
      return clone(JSON.parse(sessionStorage.getItem('__firebase_stub_data') || 'null'));
    } catch {
      return null;
    }
  })();
  const persistRemote = () => sessionStorage.setItem('__firebase_stub_data', JSON.stringify(storedData));
  const snapshot = value => ({
    exists: () => value !== null && value !== undefined,
    val: () => clone(value)
  });
  const notify = () => listeners.forEach(callback => callback(snapshot(storedData)));

  const database = {
    ref(path) {
      if (path === '.info/connected') {
        return {
          on(event, callback) {
            setTimeout(() => callback(snapshot(true)), 0);
          }
        };
      }
      return {
        once: () => {
          if (failReads > 0) {
            failReads -= 1;
            return Promise.reject(new Error('simulated read failure'));
          }
          return Promise.resolve(snapshot(storedData));
        },
        set(value) {
          storedData = clone(value);
          persistRemote();
          notify();
          return Promise.resolve();
        },
        on(event, callback) {
          listeners.push(callback);
        },
        async transaction(update) {
          const next = update(clone(storedData));
          if (next === undefined) return { committed: false, snapshot: snapshot(storedData) };
          if (transactionDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, transactionDelay));
          }
          storedData = clone(next);
          persistRemote();
          notify();
          if (failAfterCommit > 0) {
            failAfterCommit -= 1;
            throw new Error('simulated lost transaction response');
          }
          return { committed: true, snapshot: snapshot(storedData) };
        }
      };
    }
  };
  const auth = {
    currentUser: { email: 'gomajupa@gmail.com', emailVerified: true },
    onAuthStateChanged(callback) {
      setTimeout(() => callback(this.currentUser), 0);
      return () => {};
    },
    signInWithPopup: () => Promise.resolve(),
    signOut: () => Promise.resolve()
  };
  function authFactory() { return auth; }
  authFactory.GoogleAuthProvider = class { setCustomParameters() {} };
  function appCheckFactory() { return { activate: () => {} }; }
  appCheckFactory.ReCaptchaEnterpriseProvider = class {};

  window.__firebaseTest = {
    setStoredData(value) {
      storedData = clone(value);
      persistRemote();
      notify();
    },
    getStoredData() {
      return clone(storedData);
    },
    setTransactionDelay(milliseconds) {
      transactionDelay = Math.max(0, Number(milliseconds) || 0);
    },
    failNextCommittedResponseAndReads(readCount = 1) {
      failAfterCommit += 1;
      failReads += Math.max(0, Number(readCount) || 0);
    }
  };

  window.firebase = {
    apps: [],
    initializeApp() { this.apps.push({}); return {}; },
    appCheck: appCheckFactory,
    database: () => database,
    auth: authFactory
  };
}

module.exports = { firebaseStub };
