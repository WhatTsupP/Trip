let trips = JSON.parse(localStorage.getItem('trips_v_premium')) || {};
let currentTrip = null;

// Core Storage & Navigation
function save() { 
    localStorage.setItem('trips_v_premium', JSON.stringify(trips)); 
    render(); 
}

function backToHome() { 
    currentTrip = null; 
    document.getElementById('homeView').classList.remove('hidden'); 
    document.getElementById('tripDetailView').classList.add('hidden'); 
    render(); 
}

function openTrip(name) { 
    currentTrip = name; 
    document.getElementById('homeView').classList.add('hidden'); 
    document.getElementById('tripDetailView').classList.remove('hidden'); 
    document.getElementById('currentTripTitle').innerText = name; 
    render(); 
}

// Modal Management
function openCreateTrip() { document.getElementById('createTripModal').style.display = 'flex'; }
function closeCreateTrip() { document.getElementById('createTripModal').style.display = 'none'; }

function confirmAddTrip() {
    const input = document.getElementById('tripNameInput'), name = input.value.trim();
    if (!name) return;
    if (!trips[name]) { 
        trips[name] = { items: [], members: [] }; 
        save(); 
        closeCreateTrip(); 
        openTrip(name); 
    }
    else showModal("ชื่อซ้ำ", "คุณมีทริปชื่อนี้อยู่แล้วครับ", null, 'alert');
}

function showModal(title, msg, onConfirm, type = 'alert') {
    const modal = document.getElementById('customModal');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = msg;
    document.getElementById('modalIcon').innerHTML = type === 'alert' ? '<i class="fas fa-exclamation-circle text-rose-500"></i>' : '<i class="fas fa-question-circle text-blue-600"></i>';
    document.getElementById('modalCancelBtn').style.display = type === 'confirm' ? 'block' : 'none';
    modal.style.display = 'flex';
    document.getElementById('modalConfirmBtn').onclick = () => { modal.style.display = 'none'; if(onConfirm) onConfirm(); };
    document.getElementById('modalCancelBtn').onclick = () => { modal.style.display = 'none'; };
}

// Logic & Calculations
function checkCategory(val) { document.getElementById('remarkContainer').style.display = (val === 'อื่นๆ') ? 'block' : 'none'; }

function checkSplitLogic(input) {
    if (input.value < 0) input.value = '';
    const statusSelect = document.getElementById('itemStatus');
    if (input.value === "1") { 
        statusSelect.value = "จ่ายแล้ว"; 
        statusSelect.disabled = true; 
    } 
    else statusSelect.disabled = false;
}

function addMember() {
    const input = document.getElementById('memberInput'), name = input.value.trim();
    if (!name || !currentTrip) return;
    if (trips[currentTrip].members.includes(name)) { 
        showModal("ชื่อสมาชิกซ้ำ", `คุณมีชื่อ "${name}" ในทริปนี้แล้วครับ`, null, 'alert'); 
        return; 
    }
    trips[currentTrip].members.push(name); 
    input.value = ''; 
    save();
}

function removeMember(name) {
    showModal("ลบสมาชิก", `คุณต้องการลบ "${name}" ออกจากทริปหรือไม่?`, () => {
        let problematicItems = [];
        trips[currentTrip].members = trips[currentTrip].members.filter(m => m !== name);

        trips[currentTrip].items.forEach(item => {
            let affected = false;
            if (item.payersStatus && item.payersStatus.hasOwnProperty(name)) {
                delete item.payersStatus[name];
                if (item.split > 1) item.split -= 1;
                affected = true;
            }
            if (item.note === name) {
                item.note = "ยังไม่ได้ระบุ";
                affected = true;
            }

            if (affected) {
                const share = item.amount / item.split;
                const isBalanced = Math.abs((share * item.split) - item.amount) < 0.01;
                if (!isBalanced || item.note === "ยังไม่ได้ระบุ") problematicItems.push(item.name);
                
                const allPaid = Object.values(item.payersStatus).every(v => v === true);
                item.status = (allPaid && item.note !== "ยังไม่ได้ระบุ") ? 'จ่ายแล้ว' : 'ยังไม่จ่าย';
            }
        });

        save();
        if (problematicItems.length > 0) {
            setTimeout(() => {
                showModal("ยอดเงินไม่ดุล!", `ลบสำเร็จ แต่โปรดตรวจสอบรายการดังต่อไปนี้:\n- ${problematicItems.join('\n- ')}`, null, 'alert');
            }, 500);
        }
    }, 'confirm');
}

function addItem() {
    if (!currentTrip) return;
    const elCat = document.getElementById('itemCategory'), 
          elName = document.getElementById('itemName'), 
          elAmount = document.getElementById('itemAmount'), 
          elSplit = document.getElementById('itemSplit'), 
          elNote = document.getElementById('itemNote'), 
          elRemark = document.getElementById('itemRemark');

    if (!elCat.value || !elName.value || !elAmount.value || !elSplit.value || !elNote.value) {
        [elCat, elName, elAmount, elSplit, elNote].forEach(el => !el.value && el.classList.add('input-error'));
        return;
    }

    let payersStatus = {};
    trips[currentTrip].members.forEach(m => { 
        payersStatus[m] = (document.getElementById('itemStatus').value === 'จ่ายแล้ว' || m === elNote.value); 
    });

    trips[currentTrip].items.push({ 
        id: Date.now(), 
        category: elCat.value === 'อื่นๆ' ? `อื่นๆ (${elRemark.value.trim()})` : elCat.value, 
        name: elName.value.trim(), 
        amount: parseFloat(elAmount.value), 
        split: parseInt(elSplit.value), 
        status: document.getElementById('itemStatus').value, 
        note: elNote.value, 
        payersStatus: payersStatus 
    });

    elName.value = ''; elAmount.value = ''; elSplit.value = ''; elRemark.value = ''; 
    save();
}

// Settlement UI
function openSettlement(itemId) {
    const item = trips[currentTrip].items.find(i => i.id === itemId);
    const payerSection = document.getElementById('payerFixedSection'), 
          list = document.getElementById('settlementList');
    
    payerSection.innerHTML = ''; list.innerHTML = '';
    Object.keys(item.payersStatus).forEach(name => {
        const isPaid = item.payersStatus[name], isPayer = (name === item.note);
        if (isPayer) {
            payerSection.innerHTML = `<div class="member-settle-btn badge-payer-fixed"><span class="text-sm font-semibold">${name} (คนออกเงิน)</span><span class="text-xs font-bold">ยืนยันแล้ว</span></div>`;
        } else {
            list.innerHTML += `<button class="member-settle-btn ${isPaid ? 'badge-locked' : 'badge-action-pay'}" onclick="${isPaid ? '' : `confirmPayIndividual(${itemId}, '${name}')`}"><span class="text-sm font-semibold">${name}</span><span class="text-xs font-bold">${isPaid ? '✓ จ่ายแล้ว' : 'กดจ่ายเงิน'}</span></button>`;
        }
    });
    document.getElementById('settlementModal').style.display = 'flex';
}

function confirmPayIndividual(itemId, name) {
    const item = trips[currentTrip].items.find(i => i.id === itemId);
    item.payersStatus[name] = true;
    if (Object.values(item.payersStatus).every(v => v === true)) item.status = 'จ่ายแล้ว';
    save(); 
    openSettlement(itemId);
}

function closeSettlement() { document.getElementById('settlementModal').style.display = 'none'; }
function removeItem(id) { trips[currentTrip].items = trips[currentTrip].items.filter(i => i.id !== id); save(); }
function confirmDeleteTrip(name) { showModal("ลบทริป", `ต้องการลบทริป "${name}" และข้อมูลทั้งหมดถาวรหรือไม่?`, () => { delete trips[name]; backToHome(); }, 'confirm'); }

// Rendering
function render() {
    // Render Home Grid
    const grid = document.getElementById('tripListGrid'); grid.innerHTML = '';
    Object.keys(trips).forEach(name => {
        let total = trips[name].items.reduce((sum, i) => sum + i.amount, 0);
        grid.innerHTML += `<div class="trip-card group" onclick="openTrip('${name}')"><button class="delete-trip-btn-home" onclick="event.stopPropagation(); confirmDeleteTrip('${name}')"><i class="fas fa-trash-alt"></i></button><div class="mb-6"><h4 class="text-xl font-bold text-slate-800 transition-colors group-hover:text-blue-600 mb-2">${name}</h4><div class="flex gap-2"><span class="trip-badge-mini">${trips[name].items.length} รายการ</span><span class="trip-badge-mini">${trips[name].members.length} สมาชิก</span></div></div><div class="flex justify-between items-end mt-4 pt-5 border-t border-slate-50"><div><p class="text-[10px] font-bold text-slate-400 uppercase mb-1">ยอดรวม</p><p class="text-xl font-black text-slate-800">฿${total.toLocaleString()}</p></div><div class="text-blue-600 text-sm font-bold">เปิดดู <i class="fas fa-arrow-right"></i></div></div></div>`;
    });

    if (!currentTrip) return;

    const members = trips[currentTrip].members, items = trips[currentTrip].items;
    
    // Update Payer Select
    document.getElementById('itemNote').innerHTML = '<option value="">-- ใครสำรองจ่าย? --</option>' + members.map(m => `<option value="${m}">${m}</option>`).join('');
    
    // Render Items Table & Stats
    const listBody = document.getElementById('itemsListBody'); listBody.innerHTML = '';
    let totalTrip = 0, cats = {}, mData = {}; 
    members.forEach(m => mData[m] = { res: 0, owe: 0, paid: 0 });

    items.forEach(item => {
        totalTrip += item.amount;
        cats[item.category] = (cats[item.category] || 0) + item.amount;
        if (mData[item.note]) mData[item.note].res += item.amount;
        const share = item.amount / item.split;
        const isError = Math.abs((share * item.split) - item.amount) > 0.01 || item.note === "ยังไม่ได้ระบุ" || item.split <= 0;

        Object.keys(item.payersStatus).forEach(m => {
            if (mData[m]) {
                if (m !== item.note) { 
                    if (item.payersStatus[m]) mData[m].paid += share; else mData[m].owe += share; 
                } else {
                    mData[m].paid += share;
                }
            }
        });

        listBody.innerHTML += `<tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isError ? 'row-error' : ''}">
            <td class="p-5 font-medium"><span class="cat-tag">${item.category}</span></td>
            <td class="p-5 font-bold">${item.name} ${item.note === 'ยังไม่ได้ระบุ' ? '<span class="text-red-500 text-[10px] block">! ขาดคนสำรองจ่าย</span>' : ''}</td>
            <td class="p-5 text-right font-bold text-slate-800">฿${item.amount.toLocaleString()}</td>
            <td class="p-5 text-center"><span class="badge-style ${item.status === 'จ่ายแล้ว' ? 'status-paid-badge' : 'status-unpaid-badge'}">${item.status}</span></td>
            <td class="p-5 text-center"><button onclick="openSettlement(${item.id})" class="badge-style dash-blue"><i class="fas fa-users-cog"></i> เช็ค</button></td>
            <td class="p-5 text-center"><i class="fas fa-trash-can btn-icon-red text-base" onclick="removeItem(${item.id})"></i></td>
        </tr>`;
    });

    document.getElementById('totalTripAmount').innerText = '฿' + totalTrip.toLocaleString();
    document.getElementById('categorySummary').innerText = Object.entries(cats).map(([k,v]) => `${k}: ฿${v.toLocaleString()}`).join(' | ') || 'ไม่มีข้อมูล';
    document.getElementById('memberDashboardSummary').innerHTML = members.map(m => `${m}: ค้าง <span class="text-rose-600">฿${mData[m].owe.toLocaleString()}</span> | จ่าย <span class="text-emerald-600">฿${mData[m].paid.toLocaleString()}</span>`).join('<br>') || 'ยังไม่มีสมาชิก';
    
    const mTableBody = document.getElementById('memberTableBody'); mTableBody.innerHTML = '';
    members.forEach(m => {
        mTableBody.innerHTML += `<tr class="border-b border-slate-50 hover:bg-slate-50"><td class="p-5 font-bold text-slate-700">👤 ${m}</td><td class="p-5 text-right font-bold text-blue-600">฿${mData[m].res.toLocaleString()}</td><td class="p-5 text-right font-bold text-rose-500">฿${mData[m].owe.toLocaleString()}</td><td class="p-5 text-right font-bold text-emerald-600">฿${mData[m].paid.toLocaleString()}</td><td class="p-5 text-center"><i class="fas fa-user-minus btn-icon-red text-base" onclick="removeMember('${m}')"></i></td></tr>`;
    });
}

// Initialization
render();