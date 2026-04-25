const DEFAULT_CATS = [
    { id: 'c1', name: '胸部' },
    { id: 'c2', name: '背部' },
    { id: 'c3', name: '腿部' },
    { id: 'c4', name: '肩部' },
    { id: 'c5', name: '手部' },
    { id: 'c6', name: '核心' },
    { id: 'c7', name: '有氧' }
];

const DEFAULT_EXS = {
    'c1': [{id:'e1', name:'槓鈴臥推'}, {id:'e2', name:'啞鈴飛鳥'}, {id:'e3', name:'機械胸推'}],
    'c2': [{id:'e4', name:'滑輪下拉'}, {id:'e5', name:'槓鈴划船'}, {id:'e6', name:'引體向上'}],
    'c3': [{id:'e7', name:'槓鈴深蹲'}, {id:'e8', name:'腿推機'}, {id:'e9', name:'羅馬尼亞硬舉'}],
    'c4': [{id:'e10', name:'啞鈴肩推'}, {id:'e11', name:'側平舉'}, {id:'e12', name:'滑輪面拉'}],
    'c5': [{id:'e13', name:'二頭彎舉'}, {id:'e14', name:'三頭下壓'}],
    'c6': [{id:'e15', name:'捲腹'}, {id:'e16', name:'棒式'}],
    'c7': [{id:'e17', name:'跑步機'}, {id:'e18', name:'飛輪'}, {id:'e19', name:'橢圓機'}, {id:'e20', name:'划船機'}]
};

const store = {
    getDateKey(date) {
        const d = date || new Date();
        return `fitlog_v2_day_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    },

    getDayRecord(date) {
        const key = this.getDateKey(date);
        try {
            return JSON.parse(localStorage.getItem(key)) || this.emptyRecord();
        } catch { return this.emptyRecord(); }
    },

    emptyRecord() {
        return { duration: 60, feeling: '正常發揮', notes: '', types: [], activities: [] };
    },

    saveDayRecord(date, record) {
        localStorage.setItem(this.getDateKey(date), JSON.stringify(record));
    },

    // Training Types
    getTrainingTypes() {
        try {
            return JSON.parse(localStorage.getItem('fitlog_v2_training_types')) || ['重訓', '有氧', '拉筋'];
        } catch { return ['重訓', '有氧', '拉筋']; }
    },
    saveTrainingTypes(types) { localStorage.setItem('fitlog_v2_training_types', JSON.stringify(types)); },

    // Categories
    getHiddenDefaults() {
        try { return JSON.parse(localStorage.getItem('fitlog_v2_hidden')) || { cats: [], exs: [] }; }
        catch { return { cats: [], exs: [] }; }
    },
    saveHiddenDefaults(h) { localStorage.setItem('fitlog_v2_hidden', JSON.stringify(h)); },

    getCategories() {
        const h = this.getHiddenDefaults();
        const custom = JSON.parse(localStorage.getItem('fitlog_v2_custom_cats') || '[]');
        return [...DEFAULT_CATS.filter(c => !h.cats.includes(c.id)), ...custom];
    },
    addCustomCategory(name) {
        const custom = JSON.parse(localStorage.getItem('fitlog_v2_custom_cats') || '[]');
        const newCat = { id: 'cc' + Date.now(), name };
        custom.push(newCat);
        localStorage.setItem('fitlog_v2_custom_cats', JSON.stringify(custom));
        return newCat;
    },
    deleteCustomCategory(id) {
        let custom = JSON.parse(localStorage.getItem('fitlog_v2_custom_cats') || '[]');
        custom = custom.filter(c => c.id !== id);
        localStorage.setItem('fitlog_v2_custom_cats', JSON.stringify(custom));
    },

    // Exercises
    getExercises(catId) {
        const h = this.getHiddenDefaults();
        const custom = JSON.parse(localStorage.getItem('fitlog_v2_custom_exs') || '{}');
        return [...(DEFAULT_EXS[catId] || []).filter(e => !h.exs.includes(e.id)), ...(custom[catId] || [])];
    },
    hideDefaultCat(id) {
        const h = this.getHiddenDefaults();
        if (!h.cats.includes(id)) h.cats.push(id);
        this.saveHiddenDefaults(h);
    },
    hideDefaultEx(exId) {
        const h = this.getHiddenDefaults();
        if (!h.exs.includes(exId)) h.exs.push(exId);
        this.saveHiddenDefaults(h);
    },
    addCustomExercise(catId, name) {
        const custom = JSON.parse(localStorage.getItem('fitlog_v2_custom_exs') || '{}');
        if (!custom[catId]) custom[catId] = [];
        const newEx = { id: 'ce' + Date.now(), name };
        custom[catId].push(newEx);
        localStorage.setItem('fitlog_v2_custom_exs', JSON.stringify(custom));
    },
    deleteCustomExercise(catId, exId) {
        const custom = JSON.parse(localStorage.getItem('fitlog_v2_custom_exs') || '{}');
        if (custom[catId]) custom[catId] = custom[catId].filter(e => e.id !== exId);
        localStorage.setItem('fitlog_v2_custom_exs', JSON.stringify(custom));
    },

    // Settings
    getSettings() {
        try { return JSON.parse(localStorage.getItem('fitlog_v2_settings')) || { weight: 70, height: 170 }; }
        catch { return { weight: 70, height: 170 }; }
    },
    saveSettings(s) { localStorage.setItem('fitlog_v2_settings', JSON.stringify(s)); },

    // Helpers for history stats
    getAllDayKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('fitlog_v2_day_')) keys.push(k);
        }
        return keys;
    }
};
