function prestamosFirebaseStub() {
  const listeners = [];
  const writes = [];
  const apps = [];
  let data;
  let initialized = false;
  let pushCounter = 0;
  let failedTransactions = 0;

  const clone = value => value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));

  const parts = path => String(path || '')
    .split('/')
    .filter(Boolean);

  const normalize = path => parts(path).join('/');

  function ensureData() {
    if (!initialized) {
      data = clone(window.__PRESTAMOS_FIREBASE_SEED__ || {});
      initialized = true;
    }
    return data;
  }

  function valueAt(path) {
    let current = ensureData();
    for (const part of parts(path)) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  function setAt(path, value) {
    const pathParts = parts(path);
    if (!pathParts.length) {
      data = value === null ? {} : clone(value);
      initialized = true;
      return;
    }

    let current = ensureData();
    for (let i = 0; i < pathParts.length - 1; i += 1) {
      const part = pathParts[i];
      if (!current[part] || typeof current[part] !== 'object') current[part] = {};
      current = current[part];
    }

    const last = pathParts[pathParts.length - 1];
    if (value === null) delete current[last];
    else current[last] = clone(value);
  }

  function pathsAreRelated(a, b) {
    const left = normalize(a);
    const right = normalize(b);
    return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
  }

  function applyQuery(rawValue, query) {
    let entries = rawValue && typeof rawValue === 'object'
      ? Object.entries(rawValue)
      : [];

    if (query.orderByChild) {
      const childPath = parts(query.orderByChild);
      const childValue = value => childPath.reduce(
        (current, part) => current === null || current === undefined ? undefined : current[part],
        value
      );

      entries.sort(([, a], [, b]) => {
        const av = childValue(a);
        const bv = childValue(b);
        return av === bv ? 0 : av > bv ? 1 : -1;
      });

      if (Object.prototype.hasOwnProperty.call(query, 'equalTo')) {
        entries = entries.filter(([, value]) => childValue(value) === query.equalTo);
      }
    }

    if (Number.isFinite(query.limitToLast)) {
      entries = entries.slice(-query.limitToLast);
    }

    if (!entries.length) return null;
    return Object.fromEntries(entries.map(([key, value]) => [key, clone(value)]));
  }

  function snapshot(path, query = {}) {
    const rawValue = clone(valueAt(path));
    const queried = query.orderByChild || Number.isFinite(query.limitToLast)
      ? applyQuery(rawValue, query)
      : rawValue;
    const value = queried === undefined ? null : queried;

    return {
      key: parts(path).at(-1) || null,
      val: () => clone(value),
      exists: () => value !== null && value !== undefined,
      forEach: callback => {
        if (!value || typeof value !== 'object') return false;
        for (const [key, childValue] of Object.entries(value)) {
          const stopped = callback({
            key,
            val: () => clone(childValue),
            exists: () => childValue !== null && childValue !== undefined
          });
          if (stopped === true) return true;
        }
        return false;
      }
    };
  }

  function notify(changedPath) {
    for (const listener of listeners) {
      if (!pathsAreRelated(listener.path, changedPath)) continue;
      setTimeout(() => listener.callback(snapshot(listener.path, listener.query)), 0);
    }
  }

  function makeRef(path = '', query = {}) {
    const normalizedPath = normalize(path);
    return {
      key: parts(normalizedPath).at(-1) || null,

      child(childPath) {
        return makeRef([normalizedPath, normalize(childPath)].filter(Boolean).join('/'), query);
      },

      limitToLast(limit) {
        return makeRef(normalizedPath, { ...query, limitToLast: Number(limit) });
      },

      orderByChild(childPath) {
        return makeRef(normalizedPath, { ...query, orderByChild: childPath });
      },

      equalTo(expected) {
        return makeRef(normalizedPath, { ...query, equalTo: expected });
      },

      once(event, callback) {
        if (event !== 'value') return Promise.reject(new Error(`Evento Firebase no soportado: ${event}`));
        const result = normalizedPath === '.info/connected'
          ? { val: () => true, exists: () => true, key: 'connected' }
          : snapshot(normalizedPath, query);
        if (callback) setTimeout(() => callback(result), 0);
        return Promise.resolve(result);
      },

      on(event, callback) {
        if (event !== 'value') throw new Error(`Evento Firebase no soportado: ${event}`);
        if (normalizedPath === '.info/connected') {
          setTimeout(() => callback({ val: () => true, exists: () => true, key: 'connected' }), 0);
          return callback;
        }
        listeners.push({ path: normalizedPath, query: { ...query }, callback });
        setTimeout(() => callback(snapshot(normalizedPath, query)), 0);
        return callback;
      },

      off(event, callback) {
        for (let index = listeners.length - 1; index >= 0; index -= 1) {
          const listener = listeners[index];
          if (listener.path === normalizedPath && (!callback || listener.callback === callback)) {
            listeners.splice(index, 1);
          }
        }
      },

      set(value) {
        setAt(normalizedPath, value);
        writes.push({ operation: 'set', path: normalizedPath, value: clone(value) });
        notify(normalizedPath);
        return Promise.resolve();
      },

      update(values) {
        for (const [childPath, value] of Object.entries(values || {})) {
          setAt([normalizedPath, normalize(childPath)].filter(Boolean).join('/'), value);
        }
        writes.push({ operation: 'update', path: normalizedPath, value: clone(values) });
        notify(normalizedPath);
        return Promise.resolve();
      },

      remove() {
        setAt(normalizedPath, null);
        writes.push({ operation: 'remove', path: normalizedPath });
        notify(normalizedPath);
        return Promise.resolve();
      },

      transaction(updateFunction) {
        if (failedTransactions > 0) {
          failedTransactions -= 1;
          return Promise.reject(new Error('Fallo de transacción simulado'));
        }
        const nextValue = updateFunction(clone(valueAt(normalizedPath)));
        if (nextValue === undefined) {
          return Promise.resolve({ committed: false, snapshot: snapshot(normalizedPath, query) });
        }
        setAt(normalizedPath, nextValue);
        writes.push({ operation: 'transaction', path: normalizedPath, value: clone(nextValue) });
        notify(normalizedPath);
        return Promise.resolve({ committed: true, snapshot: snapshot(normalizedPath, query) });
      },

      push(value) {
        pushCounter += 1;
        const key = `test_push_${String(pushCounter).padStart(4, '0')}`;
        const pushedRef = makeRef([normalizedPath, key].filter(Boolean).join('/'));
        const promise = value === undefined ? Promise.resolve() : pushedRef.set(value);
        promise.key = key;
        return promise;
      }
    };
  }

  const database = () => ({ ref: path => makeRef(path) });
  database.ServerValue = { TIMESTAMP: 1700000000000 };

  window.firebase = {
    apps,
    initializeApp(config) {
      const app = { options: clone(config), name: '[DEFAULT]' };
      apps.push(app);
      return app;
    },
    app() {
      if (!apps.length) throw new Error('Firebase no inicializado');
      return apps[0];
    },
    database
  };

  window.__prestamosFirebaseTest = {
    getData: () => clone(ensureData()),
    getWrites: () => clone(writes),
    getValue: path => clone(valueAt(path)),
    failNextTransaction: () => { failedTransactions += 1; },
    replaceData: replacement => {
      data = clone(replacement || {});
      initialized = true;
      notify('');
    }
  };
}

module.exports = { prestamosFirebaseStub };
