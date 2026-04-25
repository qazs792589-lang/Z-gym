const app = {
    state: {
        viewDate: new Date(),
        currentCat: null,
        currentEx: null,
        repsValue: 10,
        trainValue: 30,
        trainUnit: '秒',
        restUnit: '秒',
        weeksOffset: 0,
        wheelCallback: null,
        wheelValue: 0,
        repsScrollTimeout: null,
        trainScrollTimeout: null,
        detailDate: null
    },

    init() {
        window.app = this;
        this.renderRecordView();
        this.renderSettingsView();
        this.initRepsWheel();
        this.initTrainWheel();
    },

    // ─── NAVIGATION ──────────────────────────────────────────
    switchTab(tabId, el) {
        // If editing in a sub-view, ask before leaving
        const activeSub = document.querySelector('.sub-view.active');
        if (activeSub) {
            if (!confirm('您正在編輯中，確定離開？\n（已記錄的組數已自動儲存）')) return;
            document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
        }
        document.querySelectorAll('.main-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(v => v.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        if (el) el.classList.add('active');

        if (tabId === 'view-record') this.renderRecordView();
        if (tabId === 'view-history') this.renderHistoryView();
        if (tabId === 'view-summary') this.generateSummary('today');
        if (tabId === 'view-settings') this.renderSettingsView();
    },

    navToSub(subId) {
        document.getElementById(subId).classList.add('active');
        if (subId === 'view-exercise-picker') this.renderCatPicker();
        if (subId === 'view-manage-db') this.renderManageDB();
    },

    closeSubView() {
        document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
        this.renderRecordView();
    },

    backToPicker() {
        document.getElementById('view-exercise-list').classList.remove('active');
    },

    returnToToday() {
        this.state.viewDate = new Date();
        this.renderRecordView();
    },

    changeViewDay(delta) {
        const d = this.state.viewDate;
        const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
        this.state.viewDate = next;
        this.renderRecordView();
    },

    changeDateByPicker(val) {
        if (!val) {
            this.renderRecordView(); // Re-sync display if cleared
            return;
        }
        this.state.viewDate = new Date(val);
        this.renderRecordView();
    },

    isToday(d) {
        const t = new Date();
        return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
    },

    // ─── RECORD VIEW ─────────────────────────────────────────
    renderRecordView() {
        const record = store.getDayRecord(this.state.viewDate);
        const d = this.state.viewDate;

        // Update date input (YYYY-MM-DD format)
        const dateInput = document.getElementById('today-date-badge');
        if (dateInput) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateInput.value = `${y}-${m}-${day}`;
        }

        document.getElementById('back-to-today-btn').style.display =
            this.isToday(d) ? 'none' : 'inline-block';
        // Remove forward button restriction
        const fwdBtn = document.getElementById('fwd-day-btn');
        if (fwdBtn) { fwdBtn.disabled = false; fwdBtn.style.opacity = '1'; }

        this.updateStats(record);
        this.renderTypeChips(record.types || []);
        document.getElementById('lbl-duration').innerText = record.duration || 60;
        document.getElementById('input-feeling').value = record.feeling || '正常發揮';
        document.getElementById('input-notes').value = record.notes || '';
        this.renderActionsList(record.activities || []);
    },

    updateStats(record) {
        let sets = 0, kg = 0;
        (record.activities || []).forEach(a => {
            const isCardio = a.catName === '有氧';
            sets += a.sets.length;
            if (!isCardio) {
                a.sets.forEach(s => kg += s.kg * s.reps);
            }
        });
        document.getElementById('stat-actions').innerText = record.activities.length;
        document.getElementById('stat-sets').innerText = sets;
        document.getElementById('stat-kg').innerText = Math.round(kg);
        document.getElementById('stat-time').innerText = record.duration || '-';
    },

    renderTypeChips(selectedTypes) {
        const allTypes = store.getTrainingTypes();
        const container = document.getElementById('training-types-container');
        container.innerHTML = allTypes.map(t => {
            const active = selectedTypes.includes(t) ? 'active' : '';
            return `<div class="chip ${active}" onclick="app.toggleType('${t}')">${t}</div>`;
        }).join('');
    },

    setUnit(idx, unit) {
        if (idx === 1) {
            this.state.trainUnit = unit;
            document.getElementById('btn-unit-1-sec').classList.toggle('active', unit === '秒');
            document.getElementById('btn-unit-1-min').classList.toggle('active', unit === '分');
            document.querySelectorAll('#train-wheel-container .unit-text').forEach(el => el.innerText = unit);
        } else {
            this.state.restUnit = unit;
            document.getElementById('btn-unit-2-sec').classList.toggle('active', unit === '秒');
            document.getElementById('btn-unit-2-min').classList.toggle('active', unit === '分');
            document.getElementById('unit-field2').innerText = unit;
        }
    },

    toggleUnit(idx) {
        const current = idx === 1 ? this.state.trainUnit : this.state.restUnit;
        this.setUnit(idx, current === '秒' ? '分' : '秒');
    },
    
    toggleType(type) {
        let record = store.getDayRecord(this.state.viewDate);
        if (!record.types) record.types = [];
        if (record.types.includes(type)) {
            record.types = record.types.filter(t => t !== type);
        } else {
            record.types.push(type);
        }
        store.saveDayRecord(this.state.viewDate, record);
        this.renderTypeChips(record.types);
    },

    // ─── ACTIONS LIST (grouped by weight, descending) ────────
    renderActionsList(activities) {
        const list = document.getElementById('today-actions-list');
        if (!activities || activities.length === 0) {
            list.innerHTML = '點擊「新增動作」開始紀錄';
            list.classList.add('empty');
            return;
        }
        list.classList.remove('empty');

        list.innerHTML = activities.map(act => {
            const isCardio = act.catName === '有氧';
            // Group sets by value and unit
            const groups = {};
            act.sets.forEach(s => {
                const gKey = isCardio ? `${s.kg}_${s.u1 || '秒'}` : `${s.kg}`;
                if (!groups[gKey]) groups[gKey] = [];
                groups[gKey].push(s);
            });

            const sortedKeys = Object.keys(groups).sort((a, b) => {
                if (isCardio) {
                    // Sort by unit (分 > 秒) then by value
                    const [vA, uA] = a.split('_');
                    const [vB, uB] = b.split('_');
                    if (uA !== uB) return uA === '分' ? -1 : 1;
                    return Number(vB) - Number(vA);
                }
                return Number(b) - Number(a);
            });

            const groupsHtml = sortedKeys.map(key => {
                const groupSets = groups[key];
                const first = groupSets[0];
                const repsBadges = groupSets.map(s => {
                    const u2 = s.u2 || (isCardio ? '秒' : '下');
                    const label = isCardio ? `${s.reps}${u2}${s.note ? ' 📝' : ''}` : `${s.reps}${u2}${s.note ? ' 📝' : ''}`;
                    return `<div class="rep-badge" title="${s.note || ''}" onclick="app.deleteSet('${act.exId}', '${s.id}')">${label}</div>`;
                }).join('');
                
                const u1 = first.u1 || (isCardio ? '秒' : 'kg');
                const weightLabel = isCardio ? `${first.kg}${u1}` : `${first.kg}kg`;
                return `
                <div class="weight-group-row">
                    <div class="weight-group-label">${weightLabel}</div>
                    <div class="weight-group-reps">${repsBadges}</div>
                </div>`;
            }).join('');

            return `
            <div class="action-item">
                <div class="action-item-header">
                    <span class="action-item-name">${act.exName} <span style="font-size:12px; color:var(--text-sub); font-weight:normal; opacity:0.8; margin-left:10px;">[${act.catName || '未分類'}]</span></span>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button class="btn-outline-green" style="padding:5px 12px; font-size:13px;" onclick="app.openWorkout('${act.exId}', '${act.exName}', '${act.catName || ''}')">繼續</button>
                        <span style="color:var(--danger); font-size:12px; cursor:pointer;" onclick="app.deleteActivity('${act.exId}')">刪除</span>
                    </div>
                </div>
                ${groupsHtml}
            </div>`;
        }).join('');
    },

    manualSave() {
        let record = store.getDayRecord(this.state.viewDate);
        record.feeling = document.getElementById('input-feeling').value;
        record.notes = document.getElementById('input-notes').value;
        store.saveDayRecord(this.state.viewDate, record);
        const btn = event.currentTarget;
        const orig = btn.innerHTML;
        btn.innerHTML = '✅ 已儲存！';
        setTimeout(() => btn.innerHTML = orig, 1200);
    },

    // ─── CATEGORY PICKER ─────────────────────────────────────
    renderCatPicker() {
        const cats = store.getCategories();
        document.getElementById('picker-cat-list').innerHTML = cats.map(c => `
            <div class="list-item" onclick="app.selectCategory('${c.id}', '${c.name}')">
                <span>${c.name}</span><span style="color:var(--text-sub);">›</span>
            </div>
        `).join('');
    },

    addCustomCategory() {
        const input = document.getElementById('new-cat-input');
        const name = input.value.trim();
        if (!name) return;
        store.addCustomCategory(name);
        input.value = '';
        this.renderCatPicker();
    },

    selectCategory(id, name) {
        this.state.currentCat = { id, name };
        document.getElementById('current-cat-title').innerText = name;
        this.renderExList();
        document.getElementById('view-exercise-list').classList.add('active');
    },

    renderExList() {
        const exs = store.getExercises(this.state.currentCat.id);
        document.getElementById('picker-ex-list').innerHTML = exs.map(e => `
            <div class="list-item" onclick="app.openWorkout('${e.id}', '${e.name}')">
                <span>${e.name}</span><span style="color:var(--primary); font-size:18px;">＋</span>
            </div>
        `).join('');
    },

    addCustomExercise() {
        const input = document.getElementById('new-ex-input');
        const name = input.value.trim();
        if (!name) return;
        store.addCustomExercise(this.state.currentCat.id, name);
        input.value = '';
        this.renderExList();
    },

    // ─── WORKOUT (single page) ───────────────────────────────
    openWorkout(exId, exName, catName = '') {
        this.state.currentEx = { id: exId, name: exName };
        document.getElementById('workout-title').innerText = exName;

        // Today's sets for this exercise
        const record = store.getDayRecord(this.state.viewDate);
        const act = record.activities.find(a => a.exId === exId);
        
        // If we have an existing activity or a passed catName, sync the currentCat
        if (catName) {
            this.state.currentCat = { id: '', name: catName };
        } else if (act && act.catName) {
            this.state.currentCat = { id: act.catId || '', name: act.catName };
        }

        // Dynamic labels for Cardio vs Strength
        const isCardio = this.state.currentCat && this.state.currentCat.name === '有氧';
        const label1 = isCardio ? '訓練時間' : '重量 (KG)';
        document.getElementById('label-field1').innerText = label1;
        const cardioLabel1 = document.getElementById('label-field1-cardio');
        if (cardioLabel1) cardioLabel1.innerText = label1;

        document.getElementById('label-field2-title').innerText = isCardio ? '休息時間' : '次數';
        document.getElementById('unit-field2').innerText = isCardio ? this.state.restUnit : '下';

        // Toggle visibility
        document.getElementById('input-kg-container').style.display = isCardio ? 'none' : 'block';
        document.getElementById('train-wheel-container').style.display = isCardio ? 'block' : 'none';
        document.getElementById('unit-selector-2').style.display = isCardio ? 'flex' : 'none';
        
        // Update units UI
        this.setUnit(1, this.state.trainUnit);
        this.setUnit(2, isCardio ? this.state.restUnit : '下');

        // Reset inputs
        document.getElementById('input-kg').value = '';
        document.getElementById('workout-notes').value = '';

        // Render today's log
        this.renderWorkoutLog(act);

        // Open sub-view
        document.getElementById('view-workout').classList.add('active');

        // Sync wheels
        setTimeout(() => {
            this.syncRepsWheel(this.state.repsValue);
            if (isCardio) this.syncTrainWheel(this.state.trainValue);
        }, 80);
    },

    renderWorkoutLog(act) {
        const el = document.getElementById('workout-sets-list');
        if (!act || act.sets.length === 0) {
            el.className = 'workout-log-empty';
            el.innerHTML = '今日尚無紀錄';
            return;
        }
        el.className = '';
        // Group by value and unit
        const groups = {};
        const isCardio = act.catName === '有氧';
        act.sets.forEach(s => {
            const gKey = isCardio ? `${s.kg}_${s.u1 || '秒'}` : `${s.kg}`;
            if (!groups[gKey]) groups[gKey] = [];
            groups[gKey].push(s);
        });

        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (isCardio) {
                const [vA, uA] = a.split('_');
                const [vB, uB] = b.split('_');
                if (uA !== uB) return uA === '分' ? -1 : 1;
                return Number(vB) - Number(vA);
            }
            return Number(b) - Number(a);
        });

        el.innerHTML = sortedKeys.map(key => {
            const groupSets = groups[key];
            const firstSet = groupSets[0];
            const u1 = firstSet.u1 || (isCardio ? '秒' : 'kg');
            const repsStr = groupSets.map(s => {
                const u2 = s.u2 || (isCardio ? '秒' : '下');
                return `${s.reps}${u2}`;
            }).join(' · ');
            return `<div style="display:flex; gap:10px; font-size:13px; margin-bottom:4px;">
                <span style="color:var(--primary); font-weight:800; min-width:60px;">${firstSet.kg}${u1}</span>
                <span style="color:var(--text-sub);">${repsStr}</span>
            </div>`;
        }).join('');
    },

    // ─── COMMIT SET ──────────────────────────────────────────
    commitSet(isFinished) {
        const isCardio = this.state.currentCat && this.state.currentCat.name === '有氧';
        let kg, reps;
        let u1, u2;

        if (isCardio) {
            kg = this.state.trainValue;
            reps = this.state.repsValue;
            u1 = this.state.trainUnit;
            u2 = this.state.restUnit;
        } else {
            const kgRaw = document.getElementById('input-kg').value;
            kg = parseFloat(kgRaw);
            if (kgRaw === '' || isNaN(kg) || kg < 0) {
                const input = document.getElementById('input-kg');
                input.style.color = '#ef4444';
                input.focus();
                setTimeout(() => input.style.color = '', 600);
                return;
            }
            reps = this.state.repsValue;
            u1 = 'kg';
            u2 = '下';
        }
        const note = document.getElementById('workout-notes').value.trim();

        let record = store.getDayRecord(this.state.viewDate);
        let act = record.activities.find(a => a.exId === this.state.currentEx.id);
        if (!act) {
            act = {
                catId: this.state.currentCat ? this.state.currentCat.id : '',
                catName: this.state.currentCat ? this.state.currentCat.name : '',
                exId: this.state.currentEx.id,
                exName: this.state.currentEx.name,
                sets: []
            };
            record.activities.push(act);
        }
        act.sets.push({ id: Date.now().toString(), kg, reps, u1, u2, note });
        store.saveDayRecord(this.state.viewDate, record);

        if (isFinished) {
            this.closeSubView();
        } else {
            // Clear notes, flash the input border, update log
            document.getElementById('workout-notes').value = '';
            this.renderWorkoutLog(act);
            // Update quick kg buttons to include new kg if not already
            const usedKgs = [...new Set(act.sets.map(s => s.kg))].sort((a, b) => b - a);
            document.getElementById('quick-kg-row').innerHTML = usedKgs
                .map(k => `<button class="quick-kg-btn" onclick="document.getElementById('input-kg').value=${k}">${k}kg</button>`)
                .join('');
            // Flash green border feedback
            const input = document.getElementById('input-kg');
            input.style.border = '2px solid var(--primary)';
            setTimeout(() => { input.style.border = ''; }, 600);
        }
    },

    deleteSet(exId, setId) {
        if (!confirm('刪除此組紀錄？長按為刪除')) return;
        let record = store.getDayRecord(this.state.viewDate);
        const act = record.activities.find(a => a.exId === exId);
        if (act) {
            act.sets = act.sets.filter(s => s.id !== setId);
            if (act.sets.length === 0) record.activities = record.activities.filter(a => a.exId !== exId);
            store.saveDayRecord(this.state.viewDate, record);
            this.renderRecordView();
        }
    },

    deleteActivity(exId) {
        if (!confirm('確定刪除此動作的所有組數？')) return;
        let record = store.getDayRecord(this.state.viewDate);
        record.activities = record.activities.filter(a => a.exId !== exId);
        store.saveDayRecord(this.state.viewDate, record);
        this.renderRecordView();
    },

    // ─── REPS WHEEL (index-based, no offsetTop bug) ──────────
    initRepsWheel() {
        const inner = document.getElementById('reps-wheel-inner');
        if (!inner) return;
        let html = '';
        for (let i = 0; i <= 100; i++) {
            html += `<div class="inline-wheel-item reps-wheel-item" data-val="${i}">${i}</div>`;
        }
        inner.innerHTML = html;
        const scroller = document.getElementById('reps-wheel-scroller');
        scroller.addEventListener('scroll', () => {
            clearTimeout(this.state.repsScrollTimeout);
            this.state.repsScrollTimeout = setTimeout(() => this.updateRepsSelection(), 80);
        });
    },

    syncRepsWheel(val) {
        const scroller = document.getElementById('reps-wheel-scroller');
        if (!scroller) return;
        const i = Math.max(0, val);
        scroller.scrollTop = i * 40 + 5;
        this.state.repsValue = val;
        this.updateRepsDisplay(val);
        this.markSelectedRepsItem(i);
    },

    updateRepsSelection() {
        const scroller = document.getElementById('reps-wheel-scroller');
        if (!scroller) return;
        const center = scroller.scrollTop + 75;
        const i = Math.round((center - 80) / 40);
        const clamped = Math.max(0, Math.min(100, i));
        const val = clamped;
        this.state.repsValue = val;
        this.updateRepsDisplay(val);
        this.markSelectedRepsItem(clamped);
    },

    markSelectedRepsItem(selectedIndex) {
        const items = document.querySelectorAll('.reps-wheel-item');
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === selectedIndex);
        });
    },

    updateRepsDisplay(val) {
        const el = document.getElementById('reps-display');
        if (el) el.innerText = val;
    },

    initTrainWheel() {
        const inner = document.getElementById('train-wheel-inner');
        if (!inner) return;
        let html = '';
        for (let i = 0; i <= 300; i++) {
            html += `<div class="inline-wheel-item train-wheel-item" data-val="${i}">${i}</div>`;
        }
        inner.innerHTML = html;
        const scroller = document.getElementById('train-wheel-scroller');
        scroller.addEventListener('scroll', () => {
            clearTimeout(this.state.trainScrollTimeout);
            this.state.trainScrollTimeout = setTimeout(() => this.updateTrainSelection(), 80);
        });
    },

    syncTrainWheel(val) {
        const scroller = document.getElementById('train-wheel-scroller');
        if (!scroller) return;
        const i = Math.max(0, val);
        scroller.scrollTop = i * 40 + 5;
        this.state.trainValue = val;
        this.updateTrainDisplay(val);
        this.markSelectedTrainItem(i);
    },

    updateTrainSelection() {
        const scroller = document.getElementById('train-wheel-scroller');
        if (!scroller) return;
        const center = scroller.scrollTop + 75;
        const i = Math.round((center - 80) / 40);
        const clamped = Math.max(0, Math.min(300, i));
        const val = clamped;
        this.state.trainValue = val;
        this.updateTrainDisplay(val);
        this.markSelectedTrainItem(clamped);
    },

    markSelectedTrainItem(selectedIndex) {
        const items = document.querySelectorAll('.train-wheel-item');
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === selectedIndex);
        });
    },

    updateTrainDisplay(val) {
        const el = document.getElementById('train-display');
        if (el) el.innerText = val;
    },

    // ─── TIME PICKER MODAL ───────────────────────────────────
    openTimePicker() {
        const record = store.getDayRecord(this.state.viewDate);
        this.openWheel('訓練時長 (分鐘)', 5, 300, 5, record.duration || 60, (val) => {
            const v = parseInt(val);
            document.getElementById('lbl-duration').innerText = v;
            let r = store.getDayRecord(this.state.viewDate);
            r.duration = v;
            store.saveDayRecord(this.state.viewDate, r);
            this.updateStats(r);
        });
    },

    openWheel(title, min, max, step, current, callback) {
        this.state.wheelCallback = callback;
        document.getElementById('wheel-title').innerText = title;
        const inner = document.getElementById('wheel-items-inner');
        let html = '';
        for (let i = min; i <= max; i += step) {
            html += `<div class="wheel-item" data-val="${i}">${i}</div>`;
        }
        inner.innerHTML = html;
        document.getElementById('wheel-modal').style.display = 'flex';
        const scroller = document.getElementById('wheel-scroller');
        setTimeout(() => {
            scroller.scrollTop = ((current - min) / step) * 40;
            this.handleWheelScroll();
        }, 50);
    },

    handleWheelScroll() {
        const scroller = document.getElementById('wheel-scroller');
        const items = scroller.querySelectorAll('.wheel-item');
        // center of 200px container = scrollTop + 100
        const center = scroller.scrollTop + 100;
        let closest = null, minDist = Infinity;
        items.forEach((item, i) => {
            item.classList.remove('selected');
            // Items have 80px spacer before them; each is 40px
            const itemCenter = 80 + i * 40 + 20; // = 100 + i*40
            const dist = Math.abs(itemCenter - center);
            if (dist < minDist) { minDist = dist; closest = item; }
        });
        if (closest) { closest.classList.add('selected'); this.state.wheelValue = closest.getAttribute('data-val'); }
    },

    confirmWheel() {
        if (this.state.wheelCallback) this.state.wheelCallback(this.state.wheelValue);
        this.closeWheels();
    },

    closeWheels() { document.getElementById('wheel-modal').style.display = 'none'; },

    // ─── HISTORY ─────────────────────────────────────────────
    renderHistoryView() {
        const grid = document.getElementById('calendar-days');
        if (!grid) return;
        grid.innerHTML = '';
        const today = new Date();

        // 核心邏輯：如果 weeksOffset 為 0 (初始載入)，顯示包含今天的過去 4 週。
        // 如果 offset != 0，則對齊到目標月份的 1 號。
        let baseMonday;
        let mainMonth, mainYear;

        if (this.state.weeksOffset === 0) {
            const dayOfWeek = (today.getDay() + 6) % 7;
            baseMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek - 21);
            const midDate = new Date(baseMonday.getFullYear(), baseMonday.getMonth(), baseMonday.getDate() + 14);
            mainMonth = midDate.getMonth();
            mainYear = midDate.getFullYear();
        } else {
            // 計算目標月份 (以今天為基準加減 N 個月)
            const targetDate = new Date(today.getFullYear(), today.getMonth() + (this.state.weeksOffset / 4), 1);
            mainMonth = targetDate.getMonth();
            mainYear = targetDate.getFullYear();
            // 找到該月 1 號是週幾，並回推到週一
            const firstDayOfMonth = new Date(mainYear, mainMonth, 1);
            const dayOfFirst = (firstDayOfMonth.getDay() + 6) % 7;
            baseMonday = new Date(mainYear, mainMonth, 1 - dayOfFirst);
        }

        document.getElementById('calendar-month-label').innerText = `${mainYear}年${mainMonth + 1}月`;

        // 增加到 35 天 (5 週)
        for (let i = 0; i < 35; i++) {
            const d = new Date(baseMonday.getFullYear(), baseMonday.getMonth(), baseMonday.getDate() + i);
            const isToday = this.isToday(d);
            const record = store.getDayRecord(d);
            const hasData = record.activities.length > 0;
            const isOtherMonth = d.getMonth() !== mainMonth;

            // Category tags inside cell (保持原有邏輯)
            let tagsHtml = '';
            if (hasData) {
                const cats = [...new Set(record.activities.map(a => a.catName))];
                tagsHtml = `<div class="day-tags">` +
                    cats.slice(0, 4).map(c => `<div class="day-tag">${c}</div>`).join('') +
                    `</div>`;
            }

            const cell = document.createElement('div');
            // 加入 other-month 處理非當月日期
            cell.className = `day-cell ${isToday ? 'today' : ''} ${hasData ? 'has-data' : ''} ${isOtherMonth ? 'other-month' : ''}`;
            cell.dataset.time = d.getTime();

            // 日期純數字化：移除月份標記，僅顯示 d.getDate()
            cell.innerHTML = `
                <div class="day-num">${d.getDate()}</div>
                ${tagsHtml}
            `;
            cell.onclick = () => {
                document.querySelectorAll('.day-cell.selected').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                this.showDayDetail(d);
            };
            grid.appendChild(cell);
        }
        this.updateHistoryStats();
        // Clear detail panel
        document.getElementById('day-detail-content').className = 'detail-empty';
        document.getElementById('day-detail-content').innerHTML = '<span style="font-size:18px;">📅</span><span style="font-size:12px;">點選日期查看</span>';
    },

    showDayDetail(d) {
        this.state.detailDate = d;
        const record = store.getDayRecord(d);
        const panel = document.getElementById('day-detail-content');
        const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

        const dateNavHtml = `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid var(--border-color);">
                <button onclick="app.navigateDetailDay(-1)" style="background:var(--border-color); border:none; color:var(--primary); width:28px; height:28px; border-radius:7px; font-size:17px; cursor:pointer; flex-shrink:0;">‹</button>
                <span style="font-size:12px; font-weight:900; text-align:center; flex:1; padding:0 4px;">${d.getMonth() + 1}/${d.getDate()}（週${WEEKDAY_NAMES[d.getDay()]}）</span>
                <button onclick="app.navigateDetailDay(1)" style="background:var(--border-color); border:none; color:var(--primary); width:28px; height:28px; border-radius:7px; font-size:17px; cursor:pointer; flex-shrink:0;">›</button>
            </div>
        `;

        const jumpBtn = `<button class="btn-full-green" style="font-size:12px; padding:8px; margin-top:8px;" onclick="app.jumpToDay(${d.getTime()})">✏️ 前往編輯</button>`;

        if (record.activities.length === 0) {
            panel.className = '';
            panel.innerHTML = `
                ${dateNavHtml}
                <div style="text-align:center; padding:8px 0; color:var(--text-sub); font-size:12px;">當天無訓練紀錄</div>
                ${jumpBtn}
            `;
            return;
        }

        panel.className = '';

        const metaParts = [];
        if (record.feeling) metaParts.push(record.feeling);
        if (record.duration) metaParts.push(`${record.duration}分`);
        if (record.types && record.types.length) metaParts.push(record.types.join('、'));

        const exDetailsHtml = record.activities.map(act => {
            const groups = {};
            act.sets.forEach(s => {
                if (!groups[s.kg]) groups[s.kg] = [];
                groups[s.kg].push(s);
            });
            const isCardio = act.catName === '有氧';
            const sortedKgs = Object.keys(groups).map(Number).sort((a, b) => b - a);
            const rowsHtml = sortedKgs.map(kg => {
                const unit1 = isCardio ? '秒' : 'kg';
                const unit2 = isCardio ? '秒' : '下';
                const pills = groups[kg].map(s => `<span class="detail-rep-pill">${s.reps}${unit2}</span>`).join('');
                return `<div class="detail-weight-row">
                    <span class="detail-weight-label">${kg}${unit1}</span>
                    <div style="display:flex; flex-wrap:wrap; gap:4px;">${pills}</div>
                </div>`;
            }).join('');
            return `<div class="detail-ex-row">
                <div class="detail-ex-name">${act.exName}</div>
                ${rowsHtml}
            </div>`;
        }).join('');

        panel.innerHTML = `
            ${dateNavHtml}
            <div class="detail-meta" style="font-size:11px; margin-bottom:8px;">${metaParts.join(' · ')}</div>
            <div style="border-top:1px solid var(--border-color); padding-top:8px; margin-bottom:8px;">
                ${exDetailsHtml}
            </div>
            ${record.notes ? `<div style="font-size:11px; color:var(--text-sub); margin-bottom:8px; padding:6px 8px; background:rgba(255,255,255,0.03); border-radius:8px;">📝 ${record.notes}</div>` : ''}
            ${jumpBtn}
        `;
    },

    navigateDetailDay(delta) {
        const d = this.state.detailDate;
        if (!d) return;
        const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
        // Update calendar highlight if the cell is visible
        document.querySelectorAll('.day-cell.selected').forEach(c => c.classList.remove('selected'));
        const cell = document.querySelector(`.day-cell[data-time="${next.getTime()}"]`);
        if (cell) cell.classList.add('selected');
        this.showDayDetail(next);
    },

    jumpToDay(timestamp) {
        this.state.viewDate = new Date(timestamp);
        // Switch to record tab
        document.querySelectorAll('.main-view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach((el, i) => el.classList.toggle('active', i === 0));
        document.getElementById('view-record').classList.add('active');
        this.renderRecordView();
    },

    changeWeeks(delta) { this.state.weeksOffset += delta; this.renderHistoryView(); },

    updateHistoryStats() {
        const today = new Date();
        const mainYear = today.getFullYear();
        const mainMonth = today.getMonth();

        // 本週：本週一到週日
        const dow = today.getDay(); // 0=Sun
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        const monday = new Date(mainYear, mainMonth, today.getDate() + mondayOffset);

        let wd = 0, wt = 0, md = 0, mt = 0;

        // Helper to get total duration for a day (manual duration or sum of cardio minutes)
        const getDayDuration = (record) => {
            let manual = record.duration || 0;
            let cardioMins = 0;
            record.activities.forEach(act => {
                if (act.catName === '有氧') {
                    act.sets.forEach(s => {
                        if (s.u1 === '分') cardioMins += (parseFloat(s.kg) || 0);
                    });
                }
            });
            return Math.max(manual, cardioMins);
        };

        // 週統計 (Mon → Sun, 7 days)
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
            const r = store.getDayRecord(d);
            if (r.activities.length > 0) {
                wd++;
                wt += getDayDuration(r);
            }
        }

        // 月統計 (1st → End of Month)
        const lastDay = new Date(mainYear, mainMonth + 1, 0).getDate();
        for (let i = 1; i <= lastDay; i++) {
            const d = new Date(mainYear, mainMonth, i);
            const r = store.getDayRecord(d);
            if (r.activities.length > 0) {
                md++;
                mt += getDayDuration(r);
            }
        }

        document.getElementById('hist-week-days').innerText = wd;
        document.getElementById('hist-week-time').innerText = Math.round(wt);
        document.getElementById('hist-month-days').innerText = md;
        document.getElementById('hist-month-time').innerText = Math.round(mt);
    },

    // ─── SUMMARY ─────────────────────────────────────────────
    generateSummary(range) {
        // Update button active states
        ['today', 'week', 'month'].forEach(r => {
            const btn = document.getElementById(`btn-sum-${r}`);
            if (!btn) return;
            btn.className = r === range ? 'btn-full-green' : 'btn-outline-green w-100';
        });
        const today = new Date();
        const days = range === 'today' ? 1 : (range === 'week' ? 7 : 30);
        let text = `【Fit Log - ${range === 'today' ? '今日' : range === 'week' ? '本週' : '本月'}訓練摘要】\n`;
        let totalVol = 0;
        for (let i = 0; i < days; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            const r = store.getDayRecord(d);
            if (r.activities.length > 0) {
                text += `\n📅 ${d.getMonth() + 1}/${d.getDate()} (${r.feeling}) ${r.duration}分\n`;
                text += `類型: ${(r.types || []).join(', ') || '未設定'}\n`;
                r.activities.forEach(a => {
                    const isCardio = a.catName === '有氧';
                    const vol = isCardio ? 0 : a.sets.reduce((s, x) => s + x.kg * x.reps, 0);
                    totalVol += vol;
                    const summaryLine = isCardio ? `• ${a.exName}: ${a.sets.length}組\n` : `• ${a.exName}: ${a.sets.length}組 / 容量${vol}kg\n`;
                    text += summaryLine;
                    a.sets.forEach((s, i) => {
                        const setDetail = isCardio ? `${s.kg}秒訓練 / ${s.reps}秒休息` : `${s.kg}kg × ${s.reps}下`;
                        text += `   ${i + 1}. ${setDetail}${s.note ? ` (${s.note})` : ''}\n`;
                    });
                });
            }
        }
        text += `\n══════════\n總訓練容量: ${totalVol} kg`;
        document.getElementById('ai-summary-text').innerText = text;
    },

    copySummary() {
        const el = document.getElementById('ai-summary-text');
        const text = el.innerText;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => alert('複製成功！'));
        } else {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('複製成功！');
        }
    },

    // ─── SETTINGS ────────────────────────────────────────────
    renderSettingsView() {
        const s = store.getSettings();
        const wEl = document.getElementById('setting-weight');
        const hEl = document.getElementById('setting-height');
        if (wEl) wEl.value = s.weight;
        if (hEl) hEl.value = s.height;
    },

    addTrainingType() {
        const input = document.getElementById('new-type-input');
        const val = input.value.trim();
        if (!val) return;
        const types = store.getTrainingTypes();
        if (!types.includes(val)) { types.push(val); store.saveTrainingTypes(types); }
        input.value = '';
        this.renderSettingsView();
    },

    addTrainingTypeDB() {
        const input = document.getElementById('new-type-db-input');
        const val = input ? input.value.trim() : '';
        if (!val) return;
        const types = store.getTrainingTypes();
        if (!types.includes(val)) { types.push(val); store.saveTrainingTypes(types); }
        input.value = '';
        this.renderManageDB();
    },

    removeTrainingType(type) {
        if (!confirm(`刪除「${type}」？`)) return;
        const types = store.getTrainingTypes().filter(t => t !== type);
        store.saveTrainingTypes(types);
        this.renderManageDB();
    },

    saveSettings() {
        store.saveSettings({
            weight: parseFloat(document.getElementById('setting-weight').value) || 0,
            height: parseFloat(document.getElementById('setting-height').value) || 0
        });
        alert('已儲存！');
    },

    // ─── MANAGE DB ───────────────────────────────────────────
    renderManageDB() {
        const cats = store.getCategories();
        const types = store.getTrainingTypes();

        const typesCard = `
            <div class="glass-card" style="margin-bottom:12px; padding:15px;">
                <div style="font-weight:bold; margin-bottom:12px;">訓練類型</div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                    ${types.map(t => `
                        <div class="chip active" style="cursor:default;">
                            ${t} <span onclick="app.removeTrainingType('${t}')" style="color:var(--danger); cursor:pointer; font-size:14px; font-weight:900; margin-left:4px;">×</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex; gap:8px;">
                    <input type="text" id="new-type-db-input" class="custom-input" style="flex:1; font-size:13px; padding:8px 10px;" placeholder="新增類型...">
                    <button class="btn-outline-green" style="padding:8px 14px; font-size:13px; white-space:nowrap;" onclick="app.addTrainingTypeDB()">新增</button>
                </div>
            </div>
        `;

        const catsHtml = cats.map(c => {
            const exs = store.getExercises(c.id);
            const exRows = exs.map(e => `
                <div style="display:flex; justify-content:space-between; align-items:center; margin:8px 0; padding-left:12px; font-size:14px; color:var(--text-sub);">
                    <span>· ${e.name}</span>
                    <span style="color:var(--danger); cursor:pointer; padding:4px 8px;" onclick="app.dbDeleteEx('${c.id}', '${e.id}')">刪除</span>
                </div>`).join('');
            return `
                <div class="glass-card" style="margin-bottom:12px; padding:15px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; margin-bottom:10px;">
                        <span>${c.name}</span>
                        <span style="color:var(--danger); font-size:12px; cursor:pointer; padding:4px 8px;" onclick="app.dbDeleteCat('${c.id}')">刪除部位</span>
                    </div>
                    ${exRows || '<div style="font-size:13px; color:#444; padding-left:12px;">（無動作）</div>'}
                    <div style="display:flex; gap:8px; margin-top:12px; padding-top:10px; border-top:1px solid var(--border-color);">
                        <input type="text" id="new-ex-db-${c.id}" class="custom-input" style="flex:1; font-size:13px; padding:8px 10px;" placeholder="新增動作...">
                        <button class="btn-outline-green" style="padding:8px 14px; font-size:13px; white-space:nowrap;" onclick="app.dbAddEx('${c.id}')">新增</button>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('manage-db-list').innerHTML = typesCard + catsHtml;
    },

    dbAddEx(catId) {
        const input = document.getElementById(`new-ex-db-${catId}`);
        const name = (input && input.value.trim());
        if (!name) return;
        store.addCustomExercise(catId, name);
        input.value = '';
        this.renderManageDB();
    },

    dbDeleteCat(id) {
        if (!confirm('確定刪除此部位及所有動作？')) return;
        if (DEFAULT_CATS.some(d => d.id === id)) { store.hideDefaultCat(id); }
        else { store.deleteCustomCategory(id); }
        this.renderManageDB();
    },

    dbDeleteEx(catId, exId) {
        if (!confirm('確定刪除此動作？')) return;
        const isDefault = DEFAULT_EXS[catId] && DEFAULT_EXS[catId].some(e => e.id === exId);
        if (isDefault) { store.hideDefaultEx(exId); }
        else { store.deleteCustomExercise(catId, exId); }
        this.renderManageDB();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
