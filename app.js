/**
 * The Nest Application - Core JavaScript Controller
 * Built with modular architecture, localStorage fallback, and Google Sheets sync integration.
 */

// Application Constants
const ORG_NAME = "The Nest";
const STORAGE_PREFIX = "the_nest_";

// Default State
let appState = {
  activeUser: null,
  users: [],
  customers: [],
  receipts: [],
  quotations: [],
  financeExpenses: [],
  exportLogs: [],
  settings: {
    sheetId: "14oMD82-njMs2Fq93Dq3T3X3xtWo57GcUkj4pkXEfrSA",
    gasUrl: "",
    syncEnabled: true
  },
  currentView: "login",
  selectedCustomerForDetail: null,
  selectedBirdForDetail: null,
  selectedDocForDetail: null
};

// Access levels ranking (higher index = more permissions)
const TIER_RANK = {
  "Common": 1,
  "Supervisor": 2,
  "Manager": 3,
  "Director": 4,
  "Super admin": 5
};

// ----------------------------------------------------
// Toast Notification Engine (Tailwind-based)
// ----------------------------------------------------
function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `flex items-center w-full max-w-xs p-4 mb-4 text-gray-500 bg-white rounded-lg shadow dark:text-gray-400 dark:bg-gray-800 transform translate-y-2 opacity-0 transition-all duration-300 border-l-4 ${
    type === "success" ? "border-green-500" : type === "error" ? "border-red-500" : "border-yellow-500"
  }`;

  const iconColor = type === "success" ? "text-green-500 dark:text-green-400" : type === "error" ? "text-red-500 dark:text-red-400" : "text-yellow-500 dark:text-yellow-400";
  const iconSvg = type === "success" 
    ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    : type === "error" 
    ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;

  toast.innerHTML = `
    <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${iconColor}">
      ${iconSvg}
    </div>
    <div class="ml-3 text-sm font-normal">${message}</div>
    <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" aria-label="Close">
      <span class="sr-only">Close</span>
      <svg class="w-3 h-3" fill="none" viewBox="0 0 14 14" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/></svg>
    </button>
  `;

  toastContainer.appendChild(toast);

  // Trigger animations
  setTimeout(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
    toast.classList.add("translate-y-0", "opacity-100");
  }, 10);

  // Auto dismiss after 4 seconds
  const dismissTimeout = setTimeout(() => {
    dismissToast(toast);
  }, 4000);

  toast.querySelector("button").addEventListener("click", () => {
    clearTimeout(dismissTimeout);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  toast.classList.remove("translate-y-0", "opacity-100");
  toast.classList.add("-translate-y-2", "opacity-0");
  setTimeout(() => {
    toast.remove();
  }, 300);
}

// ----------------------------------------------------
// Initialization & Storage Managers
// ----------------------------------------------------
function initApp() {
  // Replace static logos with base64 to prevent tainted canvas CORS error in file:// protocol
  if (typeof LOGO_BASE64 !== 'undefined') {
    document.querySelectorAll('img[src="logo.jpg"]').forEach(img => {
      img.src = LOGO_BASE64;
    });
  }

  // Load settings
  const savedSettings = localStorage.getItem(STORAGE_PREFIX + "settings");
  if (savedSettings) {
    appState.settings = JSON.parse(savedSettings);
    // If the saved settings don't have a sheet ID or have an empty one, fill it with the default
    if (!appState.settings.sheetId) {
      appState.settings.sheetId = "14oMD82-njMs2Fq93Dq3T3X3xtWo57GcUkj4pkXEfrSA";
      appState.settings.syncEnabled = true;
      localStorage.setItem(STORAGE_PREFIX + "settings", JSON.stringify(appState.settings));
    }
  } else {
    // Save defaults to localStorage
    localStorage.setItem(STORAGE_PREFIX + "settings", JSON.stringify(appState.settings));
  }

  // Update connection status badge
  updateConnectionStatus();

  // Load finance expenses
  const savedExpenses = localStorage.getItem(STORAGE_PREFIX + "expenses");
  if (savedExpenses) {
    appState.financeExpenses = JSON.parse(savedExpenses);
  } else {
    // Seed some mock expenses
    appState.financeExpenses = [
      { id: "EXP-01", description: "อาหารนกและเวชภัณฑ์", date: "2026-05-15", amount: 4500, category: "Supply" },
      { id: "EXP-02", description: "ค่าเครื่องมือตรวจแล็บ DNA", date: "2026-05-20", amount: 15000, category: "Equipment" }
    ];
    saveExpensesToLocal();
  }

  // Load state from localStorage or seed defaults
  const savedUsers = localStorage.getItem(STORAGE_PREFIX + "users");
  if (savedUsers) {
    appState.users = JSON.parse(savedUsers);
  } else {
    // Default system admins
    appState.users = [
      { userId: "hrdnci", password: "123456", name: "Super Admin (HRD)", tier: "Super admin", createdAt: new Date().toISOString() },
      { userId: "director1", password: "password", name: "Director Somchai", tier: "Director", createdAt: new Date().toISOString() },
      { userId: "manager1", password: "password", name: "Manager Somsri", tier: "Manager", createdAt: new Date().toISOString() },
      { userId: "staff1", password: "password", name: "Staff Sompot", tier: "Supervisor", createdAt: new Date().toISOString() },
      { userId: "viewer1", password: "password", name: "Viewer Somyot", tier: "Common", createdAt: new Date().toISOString() }
    ];
    saveUsersToLocal();
  }

  // Load export logs
  const savedExportLogs = localStorage.getItem(STORAGE_PREFIX + "export_logs");
  if (savedExportLogs) {
    appState.exportLogs = JSON.parse(savedExportLogs);
  } else {
    appState.exportLogs = [];
  }

  const savedCustomers = localStorage.getItem(STORAGE_PREFIX + "customers");
  if (savedCustomers) {
    appState.customers = JSON.parse(savedCustomers);
  } else {
    // Seed mock customers and their birds (fully synchronized)
    appState.customers = [
      {
        customerId: "C-260501",
        name: "สมเกียรติ ยอดนก",
        address: "123/45 ถ.สุขุมวิท เขตวัฒนา กรุงเทพฯ 10110",
        idCard: "1234567890123",
        phone: "0812345678",
        email: "somkiat.yodnok@gmail.com",
        type: "สำนักงานใหญ่",
        notes: "ลูกค้า VIP ตรวจนกพิราบแข่ง",
        birds: [
          { birdId: "B-260501-01", ringId: "TH-2026-001", breed: "นกพิราบแข่ง (Racing Homer)", age: "1 ปี 2 เดือน", color: "สีกระ (Blue Checker)", sex: "Male", status: "การตรวจเสร็จสิ้น", inspectedBy: "hrdnci", inspectedDate: "2026-05-28T10:00:00.000Z" },
          { birdId: "B-260501-02", ringId: "TH-2026-002", breed: "นกพิราบขาวอินเดีย", age: "6 เดือน", color: "สีขาวล้วน", sex: "Female", status: "การตรวจเสร็จสิ้น", inspectedBy: "director1", inspectedDate: "2026-05-29T11:30:00.000Z" },
          { birdId: "B-260501-03", ringId: "", breed: "นกพิราบแฟนซี", age: "3 เดือน", color: "สีน้ำตาลปนเทา", sex: "Unknown", status: "รอผลตรวจ", inspectedBy: "", inspectedDate: "" }
        ],
        createdAt: "2026-05-20T08:00:00.000Z"
      },
      {
        customerId: "C-260502",
        name: "วิภา จิตรักสัตว์",
        address: "99 หมู่ 3 ต.ศาลายา อ.พุทธมณฑล นครปฐม 73170",
        idCard: "9876543210987",
        phone: "0898765432",
        email: "wipa.petlove@hotmail.com",
        type: "สาขา",
        notes: "จัดส่งตัวอย่างทาง EMS",
        birds: [
          { birdId: "B-260502-01", ringId: "TH-2026-003", breed: "นกพิราบซันคอร์นัวร์ (Sun Conure)", age: "8 เดือน", color: "สีเหลืองส้ม", sex: "Female", status: "การตรวจเสร็จสิ้น", inspectedBy: "hrdnci", inspectedDate: "2026-05-29T15:00:00.000Z" }
        ],
        createdAt: "2026-05-22T09:15:00.000Z"
      }
    ];
    saveCustomersToLocal();
  }

  // Ensure the unassigned virtual customer exists
  let unassignedCust = appState.customers.find(c => c.customerId === "C-UNASSIGNED");
  if (!unassignedCust) {
    appState.customers.push({
      customerId: "C-UNASSIGNED",
      name: "ฝากตรวจชั่วคราว (ยังไม่มีเจ้าของ)",
      address: "ระบบส่วนกลาง The Nest",
      idCard: "0000000000000",
      phone: "0000000000",
      email: "unassigned@thenest.com",
      type: "สำนักงานใหญ่",
      notes: "สำหรับบันทึกนกตัวอย่างที่ยังไม่ระบุเจ้าของ",
      birds: [],
      createdAt: new Date().toISOString()
    });
    saveCustomersToLocal();
  }

  const savedReceipts = localStorage.getItem(STORAGE_PREFIX + "receipts");
  if (savedReceipts) {
    appState.receipts = JSON.parse(savedReceipts);
  } else {
    appState.receipts = [
      {
        documentId: "IVC-202605-0001",
        type: "Receipt",
        date: "2026-05-28",
        customerId: "C-260501",
        items: [
          { birdId: "B-260501-01", breed: "นกพิราบแข่ง (Racing Homer)", qty: 1, unit: "ตัว", price: 500, discount: 50, total: 450 },
          { birdId: "B-260501-02", breed: "นกพิราบขาวอินเดีย", qty: 1, unit: "ตัว", price: 500, discount: 50, total: 450 }
        ],
        discount: 100,
        total: 800,
        linkedQuotationId: "QT-202605-0001",
        status: "Paid",
        createdAt: "2026-05-28T10:15:00.000Z"
      }
    ];
    saveReceiptsToLocal();
  }

  const savedQuotations = localStorage.getItem(STORAGE_PREFIX + "quotations");
  if (savedQuotations) {
    appState.quotations = JSON.parse(savedQuotations);
  } else {
    appState.quotations = [
      {
        documentId: "QT-202605-0001",
        type: "Quotation",
        date: "2026-05-25",
        customerId: "C-260501",
        items: [
          { birdId: "B-260501-01", breed: "นกพิราบแข่ง (Racing Homer)", qty: 1, unit: "ตัว", price: 500, discount: 50, total: 450 },
          { birdId: "B-260501-02", breed: "นกพิราบขาวอินเดีย", qty: 1, unit: "ตัว", price: 500, discount: 50, total: 450 }
        ],
        discount: 0,
        total: 900,
        linkedQuotationId: "",
        status: "อนุมัติแล้ว",
        createdAt: "2026-05-25T10:00:00.000Z"
      }
    ];
    saveQuotationsToLocal();
  }

  // Load session
  const savedSession = sessionStorage.getItem(STORAGE_PREFIX + "active_user");
  if (savedSession) {
    appState.activeUser = JSON.parse(savedSession);
    navigateTo("dashboard");
  } else {
    navigateTo("login");
  }

  // Trigger Sheet Sync if enabled and details are filled
  if (appState.settings.syncEnabled && appState.settings.gasUrl) {
    fetchFromGoogleSheets();
  }
}

// Local Storage Save Shortcuts
function saveUsersToLocal() {
  localStorage.setItem(STORAGE_PREFIX + "users", JSON.stringify(appState.users));
}
function saveCustomersToLocal() {
  localStorage.setItem(STORAGE_PREFIX + "customers", JSON.stringify(appState.customers));
}
function saveReceiptsToLocal() {
  localStorage.setItem(STORAGE_PREFIX + "receipts", JSON.stringify(appState.receipts));
}
function saveQuotationsToLocal() {
  localStorage.setItem(STORAGE_PREFIX + "quotations", JSON.stringify(appState.quotations));
}
function saveExpensesToLocal() {
  localStorage.setItem(STORAGE_PREFIX + "expenses", JSON.stringify(appState.financeExpenses));
}

// ----------------------------------------------------
// Google Sheets Integration (Cloud Sync)
// ----------------------------------------------------
async function fetchFromGoogleSheets() {
  if (!appState.settings.gasUrl) return;
  try {
    const response = await fetch(appState.settings.gasUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "fetchData" })
    });
    const result = await response.json();
    if (result.success) {
      if (result.data.users && result.data.users.length > 0) {
        // Merge users while preserving passwords locally if they were fetched without it
        result.data.users.forEach(sheetUser => {
          let localUser = appState.users.find(u => u.userId.toLowerCase() === sheetUser.userId.toLowerCase());
          if (localUser) {
            localUser.tier = sheetUser.tier;
            localUser.name = sheetUser.name;
          } else {
            // New user from sheet (we give a dummy password since it's verified on sheet)
            appState.users.push({
              userId: sheetUser.userId,
              password: "password", // default
              name: sheetUser.name,
              tier: sheetUser.tier,
              createdAt: sheetUser.createdAt
            });
          }
        });
        saveUsersToLocal();
      }
      if (result.data.customers) {
        appState.customers = result.data.customers;
        saveCustomersToLocal();
      }
      if (result.data.receipts) {
        const allDocs = result.data.receipts;
        appState.receipts = allDocs.filter(d => d.type === "Receipt");
        appState.quotations = allDocs.filter(d => d.type === "Quotation");
        saveReceiptsToLocal();
        saveQuotationsToLocal();
      }
      showToast("ซิงค์ข้อมูลกับ Google Sheets เรียบร้อยแล้ว", "success");
      // Refresh views
      renderCurrentView();
    } else {
      showToast("ซิงค์ล้มเหลว: " + result.message, "error");
    }
  } catch (error) {
    showToast("ไม่สามารถซิงค์กับคลาวด์ได้: " + error.toString(), "error");
  }
}

async function syncTableToSheets(tableName) {
  if (!appState.settings.syncEnabled || !appState.settings.gasUrl) return;
  
  let action = "";
  let payload = [];
  
  if (tableName === "users") {
    action = "syncUsers"; // Custom action can be mapped in backend or register user
    // We synchronize user tiers through custom actions or individual updates
    return;
  } else if (tableName === "customers") {
    action = "syncCustomers";
    payload = appState.customers;
  } else if (tableName === "receipts") {
    action = "syncReceipts";
    payload = [...appState.receipts, ...appState.quotations];
  }
  
  try {
    const response = await fetch(appState.settings.gasUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: action, data: payload })
    });
    const result = await response.json();
    if (result.success) {
      showToast(`อัปโหลดตาราง ${tableName} ขึ้นคลาวด์เรียบร้อย`, "success");
    } else {
      showToast(`อัปโหลด ${tableName} ล้มเหลว: ` + result.message, "warning");
    }
  } catch (error) {
    showToast("การเชื่อมต่อคลาวด์มีปัญหา: " + error.toString(), "warning");
  }
}

function updateConnectionStatus() {
  const badge = document.getElementById("connection-status-badge");
  if (!badge) return;
  
  if (appState.settings.syncEnabled && appState.settings.gasUrl) {
    badge.innerHTML = `
      <span class="w-2.5 h-2.5 bg-green-500 rounded-full mr-2"></span>
      เชื่อมต่อคลาวด์อัตโนมัติ (Google Sheets Sync)
    `;
  } else {
    badge.innerHTML = `
      <span class="w-2.5 h-2.5 bg-yellow-500 rounded-full mr-2"></span>
      เชื่อมต่อข้อมูลภายในเครื่อง (Local Sandbox)
    `;
  }
}

// ----------------------------------------------------
// Authentication Handlers
// ----------------------------------------------------
function handleLoginSubmit(userId, password) {
  const cleanId = userId.toLowerCase().trim();
  const user = appState.users.find(u => u.userId.toLowerCase().trim() === cleanId && u.password === password);
  
  if (user) {
    appState.activeUser = {
      userId: user.userId,
      name: user.name,
      tier: user.tier
    };
    sessionStorage.setItem(STORAGE_PREFIX + "active_user", JSON.stringify(appState.activeUser));
    
    // Clear login inputs for privacy
    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
    
    showToast(`ยินดีต้อนรับคุณ ${user.name} (${user.tier})`, "success");
    navigateTo("dashboard");
  } else {
    showToast("รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง", "error");
  }
}

function handleLogout() {
  appState.activeUser = null;
  sessionStorage.removeItem(STORAGE_PREFIX + "active_user");
  
  // Clear any cache details
  appState.selectedCustomerForDetail = null;
  appState.selectedBirdForDetail = null;
  appState.selectedDocForDetail = null;

  // Clear visual inputs in DOM
  const userEl = document.getElementById("login-username");
  const passEl = document.getElementById("login-password");
  if (userEl) userEl.value = "";
  if (passEl) passEl.value = "";

  showToast("ออกจากระบบเรียบร้อยแล้ว", "success");
  navigateTo("login");
}

// ----------------------------------------------------
// Tier & Masking Helpers
// ----------------------------------------------------
function checkPermission(requiredTier) {
  return true;
}

function maskSensitiveData(value, type) {
  return value || "";
}

// ----------------------------------------------------
// Running Numbers Module (Billing)
// ----------------------------------------------------
function generateRunningNumber(type) {
  // Reset and format: Prefix-YYYYMM-XXXX
  const prefix = type === "Receipt" ? "IVC" : "QT";
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dateStr = `${year}${month}`; // e.g. "202605"
  
  // Find documents of matching type and current month from correct list
  const targetPattern = `${prefix}-${dateStr}-`;
  const docs = type === "Receipt" ? appState.receipts : appState.quotations;
  const matchingDocs = docs.filter(doc => doc.type === type && doc.documentId.startsWith(targetPattern));
  
  let nextSeq = 1;
  if (matchingDocs.length > 0) {
    const seqs = matchingDocs.map(doc => {
      const parts = doc.documentId.split("-");
      const seqPart = parseInt(parts[2], 10);
      return isNaN(seqPart) ? 0 : seqPart;
    });
    nextSeq = Math.max(...seqs) + 1;
  }
  
  const seqStr = String(nextSeq).padStart(4, '0'); // e.g. 0001
  return `${prefix}-${dateStr}-${seqStr}`;
}

// ----------------------------------------------------
// Navigation & Routing
// ----------------------------------------------------
function navigateTo(viewId) {
  appState.currentView = viewId;
  renderCurrentView();
}

function renderCurrentView() {
  const loginSection = document.getElementById("login-section");
  const appSection = document.getElementById("app-section");
  
  if (appState.currentView === "login") {
    loginSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    initPigeonAnimation();
  } else {
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    
    // Set sidebar active links
    updateSidebarActiveState();
    
    // Set user profile badge
    document.getElementById("user-name-display").innerText = appState.activeUser ? appState.activeUser.name : "Unregistered";
    document.getElementById("user-role-display").innerText = appState.activeUser ? "เจ้าหน้าที่ระบบ" : "";

    // Setup visual containers
    hideAllViewContainers();
    
    const containerId = `${appState.currentView}-view`;
    const targetEl = document.getElementById(containerId);
    if (targetEl) {
      targetEl.classList.remove("hidden");
    }

    // Call dynamic render actions
    if (appState.currentView === "dashboard") renderDashboard();
    else if (appState.currentView === "customers") renderCustomersList();
    else if (appState.currentView === "samples") renderSamplesList();
    else if (appState.currentView === "receipts") renderReceiptsList();
    else if (appState.currentView === "quotations") renderQuotationsList();
    else if (appState.currentView === "finance") renderFinance();
    else if (appState.currentView === "reports") renderReports();
    else if (appState.currentView === "admins") renderAdmins();
    else if (appState.currentView === "profile") renderProfile();
  }
}

function hideAllViewContainers() {
  const views = ["dashboard", "customers", "samples", "receipts", "quotations", "finance", "reports", "admins", "profile", "cert-preview", "receipt-preview", "bulk-preview", "summary-preview"];
  views.forEach(v => {
    const el = document.getElementById(`${v}-view`);
    if (el) el.classList.add("hidden");
  });
}

function updateSidebarActiveState() {
  const links = document.querySelectorAll(".sidebar-link");
  links.forEach(link => {
    const view = link.getAttribute("data-view");
    if (view === appState.currentView) {
      link.classList.add("bg-[#1f2937]", "text-white", "border-l-4", "border-indigo-500");
      link.classList.remove("text-gray-300", "hover:bg-gray-700");
    } else {
      link.classList.remove("bg-[#1f2937]", "text-white", "border-l-4", "border-indigo-500");
      link.classList.add("text-gray-300", "hover:bg-gray-700");
    }
  });

  // Check admin page permission to show/hide the sidebar menu
  const adminLink = document.getElementById("sidebar-admin-link");
  if (adminLink) {
    if (checkPermission("Director")) {
      adminLink.classList.remove("hidden");
    } else {
      adminLink.classList.add("hidden");
    }
  }
}

// ----------------------------------------------------
// Page: Dashboard Render
// ----------------------------------------------------
let salesChart = null;
let breedChart = null;

function renderDashboard() {
  // Today's date string (local timezone YYYY-MM-DD)
  const localToday = new Date();
  const tzOffset = localToday.getTimezoneOffset() * 60000;
  const todayStr = new Date(localToday - tzOffset).toISOString().substring(0, 10);

  // 1. Gather all birds with normalized fields
  let allBirds = [];
  appState.customers.forEach(c => {
    c.birds.forEach(b => {
      allBirds.push({
        birdId: b.birdId,
        breed: b.breed,
        sex: b.sex,
        status: b.status,
        ownerName: c.name,
        inspectedDate: b.inspectedDate || c.createdAt,
        createdAt: b.createdAt || c.createdAt
      });
    });
  });

  // Filter for today's data only
  const todayCustomers = appState.customers.filter(c => c.customerId !== "C-UNASSIGNED" && c.createdAt && c.createdAt.startsWith(todayStr)).length;
  const todayBirds = allBirds.filter(b => b.createdAt && b.createdAt.startsWith(todayStr));
  const todayVerifiedBirds = todayBirds.filter(b => b.status === "การตรวจเสร็จสิ้น").length;

  document.getElementById("dash-total-customers").innerText = todayCustomers;
  document.getElementById("dash-total-birds").innerText = todayBirds.length;
  document.getElementById("dash-verified-percentage").innerText = todayBirds.length > 0 ? Math.round((todayVerifiedBirds / todayBirds.length) * 100) + "%" : "0%";

  // Show/Hide Alert Banner & Charts section based on bird registration today
  const alertBanner = document.getElementById("dash-alert-banner");
  const chartsSection = document.getElementById("dash-charts-section");
  if (todayBirds.length === 0) {
    if (alertBanner) {
      alertBanner.innerHTML = `
        <div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-center space-x-3 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-300">
          <i class="fas fa-exclamation-circle text-xl text-amber-500"></i>
          <span class="font-semibold">ยังไม่มีการรับตัวอย่างนกในวันนี้</span>
        </div>
      `;
      alertBanner.classList.remove("hidden");
    }
    if (chartsSection) {
      chartsSection.classList.add("hidden");
    }
  } else {
    if (alertBanner) {
      alertBanner.classList.add("hidden");
    }
    if (chartsSection) {
      chartsSection.classList.remove("hidden");
    }
  }

  // Render Export Logs on Dashboard (Only today's Certificate logs)
  const logsTableBody = document.getElementById("dash-export-logs-tbody");
  if (logsTableBody) {
    logsTableBody.innerHTML = "";
    const todayLogs = (appState.exportLogs || []).filter(l => l.timestamp && l.timestamp.startsWith(todayStr) && l.docType === "Certificate").slice(0, 5);
    if (todayLogs.length === 0) {
      logsTableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">ไม่มีประวัติการส่งออกเอกสารใบรับรองในวันนี้</td></tr>`;
    } else {
      todayLogs.forEach(l => {
        const dateStr = new Date(l.timestamp).toLocaleString('th-TH', { 
          year: 'numeric', month: 'short', day: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        });
        
        let actionBadge = l.actionType === "Print"
          ? `<span class="px-2 py-1 text-xs font-semibold text-indigo-800 bg-indigo-100 rounded dark:bg-indigo-900 dark:text-indigo-200"><i class="fas fa-print mr-1"></i>พิมพ์เอกสาร</span>`
          : `<span class="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded dark:bg-green-900 dark:text-green-200"><i class="fas fa-file-pdf mr-1"></i>ดาวน์โหลด PDF</span>`;

        logsTableBody.innerHTML += `
          <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">
            <td class="px-6 py-4 text-gray-500">${dateStr} น.</td>
            <td class="px-6 py-4 font-medium">${l.userName} (${l.userId})</td>
            <td class="px-6 py-4 font-bold">${l.docId}</td>
            <td class="px-6 py-4">${l.docType}</td>
            <td class="px-6 py-4">${actionBadge}</td>
          </tr>
        `;
      });
    }
  }

  // Load static table of today's birds
  const recentTableBody = document.getElementById("dash-recent-birds-tbody");
  recentTableBody.innerHTML = "";

  // Sort by date descending
  todayBirds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (todayBirds.length === 0) {
    recentTableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500 font-semibold dark:text-gray-400">ยังไม่มีการรับตัวอย่างนกในวันนี้</td></tr>`;
  } else {
    todayBirds.forEach(b => {
      let statusBadge = "";
      if (b.status === "การตรวจเสร็จสิ้น") {
        statusBadge = `<span class="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full dark:bg-green-900 dark:text-green-200">ตรวจเสร็จสิ้น</span>`;
      } else {
        statusBadge = `<span class="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full dark:bg-yellow-900 dark:text-yellow-200">รอผลตรวจ</span>`;
      }

      let sexBadge = "";
      if (b.sex === "Male") {
        sexBadge = `<span class="text-blue-500 font-bold"><i class="fas fa-mars mr-1"></i>ตัวผู้ (♂)</span>`;
      } else if (b.sex === "Female") {
        sexBadge = `<span class="text-pink-500 font-bold"><i class="fas fa-venus mr-1"></i>ตัวเมีย (♀)</span>`;
      } else {
        sexBadge = `<span class="text-gray-400">ยังไม่ระบุ</span>`;
      }

      recentTableBody.innerHTML += `
        <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
          <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">${b.birdId}</td>
          <td class="px-6 py-4">${b.breed}</td>
          <td class="px-6 py-4">${sexBadge}</td>
          <td class="px-6 py-4">${b.ownerName}</td>
          <td class="px-6 py-4">${statusBadge}</td>
        </tr>
      `;
    });
  }

  // 2. Charts Initialization
  setTimeout(() => {
    initDashboardCharts(todayBirds);
  }, 100);
}

function initDashboardCharts(todayBirds) {
  const breedCtx = document.getElementById("breedChart");
  if (!breedCtx) return;

  // Destroy previous charts if they exist
  if (breedChart) breedChart.destroy();

  // Species distribution data
  const breedCounts = {};
  todayBirds.forEach(b => {
    // Normalise name
    const name = b.breed.split("(")[0].trim();
    breedCounts[name] = (breedCounts[name] || 0) + 1;
  });

  const breedLabels = Object.keys(breedCounts);
  const breedData = Object.values(breedCounts);

  breedChart = new Chart(breedCtx, {
    type: "doughnut",
    data: {
      labels: breedLabels.length > 0 ? breedLabels : ["ไม่มีข้อมูล"],
      datasets: [{
        data: breedData.length > 0 ? breedData : [1],
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)",
          "rgba(16, 185, 129, 0.8)",
          "rgba(245, 158, 11, 0.8)",
          "rgba(239, 68, 68, 0.8)",
          "rgba(139, 92, 246, 0.8)"
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

// ----------------------------------------------------
// Page: Customer Registration & List
// ----------------------------------------------------
function renderCustomersList() {
  const tbody = document.getElementById("customers-list-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filterType = document.getElementById("filter-customer-type").value;
  const searchVal = document.getElementById("search-customer-input").value.toLowerCase().trim();
  const filterDate = document.getElementById("filter-customer-date").value;
  const limit = parseInt(document.getElementById("limit-customer-rows").value) || 30;

  let filtered = appState.customers.filter(c => c.customerId !== "C-UNASSIGNED");
  if (filterType) {
    filtered = filtered.filter(c => c.type === filterType);
  }
  if (filterDate) {
    filtered = filtered.filter(c => c.createdAt && c.createdAt.startsWith(filterDate));
  }
  if (searchVal) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(searchVal) || 
      c.customerId.toLowerCase().includes(searchVal) || 
      c.phone.toLowerCase().includes(searchVal) ||
      (c.facebook && c.facebook.toLowerCase().includes(searchVal)) ||
      (c.lineId && c.lineId.toLowerCase().includes(searchVal))
    );
  }

  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const canEdit = checkPermission("Supervisor");
  const addBtn = document.getElementById("customer-add-btn");
  if (addBtn) {
    if (canEdit) addBtn.classList.remove("hidden");
    else addBtn.classList.add("hidden");
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-500">ไม่พบข้อมูลลูกค้าตามเงื่อนไขที่ระบุ</td></tr>`;
    return;
  }

  const limited = filtered.slice(0, limit);

  limited.forEach(c => {
    const editBtnHtml = canEdit 
      ? `<button onclick="openEditCustomerModal('${c.customerId}')" class="text-indigo-600 hover:underline text-xs font-semibold mr-3"><i class="fas fa-edit mr-1"></i>แก้ไข</button>`
      : "";

    let contactsHtml = `<div>${maskSensitiveData(c.email, "email") || "-"}</div>`;
    if (c.facebook) contactsHtml += `<div class="text-xs text-blue-600 truncate"><i class="fab fa-facebook-square mr-1"></i>${c.facebook}</div>`;
    if (c.lineId) contactsHtml += `<div class="text-xs text-green-600 truncate"><i class="fab fa-line mr-1"></i>${c.lineId}</div>`;

    tbody.innerHTML += `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
        <td class="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono">${c.customerId}</td>
        <td class="px-6 py-4 font-semibold text-gray-900 dark:text-white">${c.name}</td>
        <td class="px-6 py-4">${maskSensitiveData(c.phone, "phone")}</td>
        <td class="px-6 py-4">${contactsHtml}</td>
        <td class="px-6 py-4"><span class="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">${c.type}</span></td>
        <td class="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-300">${c.birds.length}</td>
        <td class="px-6 py-4 text-center">
          <button onclick="openCustomerDetailModal('${c.customerId}')" class="text-gray-500 hover:underline text-xs font-semibold mr-3"><i class="fas fa-info-circle mr-1"></i>ดูทั้งหมด</button>
          ${editBtnHtml}
        </td>
      </tr>
    `;
  });
}

function openCustomerDetailModal(id) {
  const c = appState.customers.find(x => x.customerId === id);
  if (!c) return;
  appState.selectedCustomerForDetail = c;
  
  document.getElementById("det-cust-id").innerText = c.customerId;
  document.getElementById("det-cust-name").innerText = c.name;
  document.getElementById("det-cust-type").innerText = c.type;
  document.getElementById("det-cust-idcard").innerText = maskSensitiveData(c.idCard, "idcard");
  document.getElementById("det-cust-phone").innerText = maskSensitiveData(c.phone, "phone");
  document.getElementById("det-cust-email").innerText = maskSensitiveData(c.email, "email");
  document.getElementById("det-cust-facebook").innerText = c.facebook || "-";
  document.getElementById("det-cust-line").innerText = c.lineId || "-";
  document.getElementById("det-cust-address").innerText = c.address;
  document.getElementById("det-cust-notes").innerText = c.notes || "-";

  const tbody = document.getElementById("det-cust-birds-tbody");
  tbody.innerHTML = "";
  if (c.birds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500">ไม่มีนกในทะเบียนของลูกค้ารายนี้</td></tr>`;
  } else {
    c.birds.forEach(b => {
      let sexHtml = "";
      if (b.sex === "Male") sexHtml = `<span class="text-blue-500">ตัวผู้ (♂)</span>`;
      else if (b.sex === "Female") sexHtml = `<span class="text-pink-500">ตัวเมีย (♀)</span>`;
      else sexHtml = `<span class="text-gray-400">ยังไม่ระบุ</span>`;

      tbody.innerHTML += `
        <tr class="border-b dark:border-gray-700 text-sm">
          <td class="px-4 py-3 font-semibold text-gray-900 dark:text-white">${b.birdId}</td>
          <td class="px-4 py-3">${b.breed}</td>
          <td class="px-4 py-3">${b.sampleType || "-"} / ${b.color || "-"}</td>
          <td class="px-4 py-3">${sexHtml}</td>
          <td class="px-4 py-3">
            <button onclick="closeModal('customer-detail-modal'); openBirdDetailsModal('${b.birdId}')" class="text-indigo-600 hover:underline">รายละเอียด</button>
          </td>
        </tr>
      `;
    });
  }

  openModal("customer-detail-modal");
}

function openAddCustomerModal() {
  document.getElementById("cust-form-mode").value = "add";
  document.getElementById("cust-form-id").value = "";
  document.getElementById("cust-form-name").value = "";
  document.getElementById("cust-form-idcard").value = "";
  document.getElementById("cust-form-phone").value = "";
  document.getElementById("cust-form-email").value = "";
  document.getElementById("cust-form-facebook").value = "";
  document.getElementById("cust-form-line").value = "";
  document.getElementById("cust-form-type").value = "สำนักงานใหญ่";
  document.getElementById("cust-form-address").value = "";
  document.getElementById("cust-form-notes").value = "";

  document.getElementById("cust-form-birds-container").innerHTML = "";

  document.getElementById("cust-modal-title").innerText = "ลงทะเบียนลูกค้าใหม่";
  openModal("customer-form-modal");
}

function openEditCustomerModal(id) {
  const c = appState.customers.find(x => x.customerId === id);
  if (!c) return;

  document.getElementById("cust-form-mode").value = "edit";
  document.getElementById("cust-form-id").value = c.customerId;
  document.getElementById("cust-form-name").value = c.name;
  document.getElementById("cust-form-idcard").value = c.idCard;
  document.getElementById("cust-form-phone").value = c.phone;
  document.getElementById("cust-form-email").value = c.email;
  document.getElementById("cust-form-facebook").value = c.facebook || "";
  document.getElementById("cust-form-line").value = c.lineId || "";
  document.getElementById("cust-form-type").value = c.type;
  document.getElementById("cust-form-address").value = c.address;
  document.getElementById("cust-form-notes").value = c.notes;

  const container = document.getElementById("cust-form-birds-container");
  container.innerHTML = "";
  
  c.birds.forEach(b => {
    addBirdRowToCustomerForm(b);
  });

  document.getElementById("cust-modal-title").innerText = "แก้ไขข้อมูลลูกค้า";
  openModal("customer-form-modal");
}

function addBirdRowToCustomerForm(birdData = null) {
  const container = document.getElementById("cust-form-birds-container");
  const tr = document.createElement("tr");
  tr.className = "border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs";
  tr.innerHTML = `
    <td class="p-2">
      <input type="text" name="bird-id" value="${birdData ? birdData.birdId : ''}" placeholder="รหัสอัตโนมัติ" readonly class="w-full text-xs p-1 bg-gray-200 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white text-center font-mono font-bold" />
    </td>
    <td class="p-2">
      <input type="text" name="bird-breed" value="${birdData ? birdData.breed : ''}" required placeholder="เช่น ซันคอร์นัวร์" class="w-full text-xs p-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
    </td>
    <td class="p-2">
      <input type="text" name="bird-ring-id" value="${birdData ? (birdData.ringId || '') : ''}" placeholder="เช่น TH-2026" class="w-full text-xs p-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
    </td>
    <td class="p-2">
      <select name="bird-sample-type" class="w-full text-xs p-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white">
        <option value="ขน" ${birdData && birdData.sampleType === 'ขน' ? 'selected' : ''}>ขน</option>
        <option value="เปลือกไข่" ${birdData && birdData.sampleType === 'เปลือกไข่' ? 'selected' : ''}>เปลือกไข่</option>
        <option value="เลือด" ${birdData && birdData.sampleType === 'เลือด' ? 'selected' : ''}>เลือด</option>
      </select>
    </td>
    <td class="p-2">
      <input type="text" name="bird-color" value="${birdData ? birdData.color : ''}" placeholder="สี" class="w-full text-xs p-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
    </td>
    <td class="p-2">
      <select name="bird-status" class="w-full text-xs p-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" onchange="toggleFormBirdSexState(this)">
        <option value="รอผลตรวจ" ${birdData && birdData.status === 'รอผลตรวจ' ? 'selected' : ''}>รอผล</option>
        <option value="การตรวจเสร็จสิ้น" ${birdData && birdData.status === 'การตรวจเสร็จสิ้น' ? 'selected' : ''}>เสร็จสิ้น</option>
      </select>
    </td>
    <td class="p-2">
      <select name="bird-sex" ${!birdData || birdData.status === 'รอผลตรวจ' ? 'disabled' : ''} class="w-full text-xs p-1 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white">
        <option value="Unknown" ${birdData && birdData.sex === 'Unknown' ? 'selected' : ''}>รอผล</option>
        <option value="Male" ${birdData && birdData.sex === 'Male' ? 'selected' : ''}>ตัวผู้ ♂</option>
        <option value="Female" ${birdData && birdData.sex === 'Female' ? 'selected' : ''}>ตัวเมีย ♀</option>
      </select>
    </td>
    <td class="p-2 text-center">
      <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
    </td>
  `;
  container.appendChild(tr);
}

function toggleFormBirdSexState(selectEl) {
  const parent = selectEl.closest("tr");
  const sexSelect = parent.querySelector("select[name='bird-sex']");
  if (selectEl.value === "การตรวจเสร็จสิ้น") {
    sexSelect.disabled = false;
  } else {
    sexSelect.value = "Unknown";
    sexSelect.disabled = true;
  }
}

function saveCustomerFormSubmit() {
  if (!checkPermission("Supervisor")) {
    showToast("คุณไม่มีระดับสิทธิ์ที่เหมาะสมในการแก้ไขข้อมูล", "error");
    return;
  }

  const mode = document.getElementById("cust-form-mode").value;
  const id = document.getElementById("cust-form-id").value;
  const name = document.getElementById("cust-form-name").value.trim();
  const idCard = document.getElementById("cust-form-idcard").value.trim();
  const phone = document.getElementById("cust-form-phone").value.trim();
  const email = document.getElementById("cust-form-email").value.trim();
  const facebook = document.getElementById("cust-form-facebook").value.trim();
  const lineId = document.getElementById("cust-form-line").value.trim();
  const type = document.getElementById("cust-form-type").value;
  const address = document.getElementById("cust-form-address").value.trim();
  const notes = document.getElementById("cust-form-notes").value.trim();

  if (!name || !phone) {
    showToast("กรุณากรอกชื่อและเบอร์โทรศัพท์", "warning");
    return;
  }

  // Validate Facebook & Line
  if (facebook && !facebook.includes("facebook.com") && facebook.length < 3) {
    showToast("กรุณากรอกลิงก์เฟสบุ๊คหรือชื่อโปรไฟล์ให้ถูกต้อง", "warning");
    return;
  }
  if (lineId && lineId.length < 2) {
    showToast("กรุณากรอก Line ID หรือเบอร์ติดต่อให้ถูกต้อง", "warning");
    return;
  }

  const birdRows = document.getElementById("cust-form-birds-container").children;
  const birds = [];
  let codeCount = 1;

  for (let i = 0; i < birdRows.length; i++) {
    const row = birdRows[i];
    let bId = row.querySelector("input[name='bird-id']").value;
    const breed = row.querySelector("input[name='bird-breed']").value.trim();
    const ringId = row.querySelector("input[name='bird-ring-id']") ? row.querySelector("input[name='bird-ring-id']").value.trim() : "";
    const sampleType = row.querySelector("select[name='bird-sample-type']").value;
    const color = row.querySelector("input[name='bird-color']").value.trim();
    const status = row.querySelector("select[name='bird-status']").value;
    const sex = row.querySelector("select[name='bird-sex']").value;

    if (!breed) {
      showToast("กรุณาระบุสายพันธุ์นกทุกตัวอย่าง", "warning");
      return;
    }

    if (!bId) {
      const parentIdPart = mode === "add" ? `B-TMP` : `B-${id.split("-")[1]}`;
      bId = `${parentIdPart}-${String(codeCount).padStart(2, '0')}`;
      codeCount++;
    }

    const originalBird = mode === "edit" ? appState.customers.find(x => x.customerId === id).birds.find(x => x.birdId === bId) : null;
    let inspectedBy = originalBird ? originalBird.inspectedBy : "";
    let inspectedDate = originalBird ? originalBird.inspectedDate : "";

    if (status === "การตรวจเสร็จสิ้น" && (!originalBird || originalBird.status === "รอผลตรวจ")) {
      inspectedBy = appState.activeUser.userId;
      inspectedDate = new Date().toISOString();
    }

    birds.push({
      birdId: bId,
      ringId: ringId,
      breed: breed,
      sampleType: sampleType,
      color: color,
      status: status,
      sex: sex,
      inspectedBy: inspectedBy,
      inspectedDate: inspectedDate,
      createdAt: originalBird ? (originalBird.createdAt || originalBird.inspectedDate || new Date().toISOString()) : new Date().toISOString()
    });
  }

  if (mode === "add") {
    // Generate customer ID based on registration date: C-YYMMDD
    const now = new Date();
    const yy = String(now.getFullYear()).substring(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${yy}${mm}${dd}`; // e.g. "260612"
    
    // Find the max daily sequence for this YYMMDD prefix among real customers
    let maxDailySeq = 0;
    appState.customers.forEach(c => {
      if (c.customerId === "C-UNASSIGNED") return;
      const idSuffix = c.customerId.replace("C-", "");
      if (idSuffix.startsWith(datePrefix)) {
        const seqStr = idSuffix.substring(datePrefix.length);
        const seqNum = parseInt(seqStr);
        if (!isNaN(seqNum) && seqNum > maxDailySeq) maxDailySeq = seqNum;
      }
    });
    const newSeq = String(maxDailySeq + 1).padStart(2, '0');
    const custIdSuffix = `${datePrefix}${newSeq}`; // e.g. "26061201"
    const generatedCustId = `C-${custIdSuffix}`;
    
    // Rewrite B-TMP bird IDs
    birds.forEach((b, idx) => {
      if (b.birdId.startsWith("B-TMP")) {
        b.birdId = `B-${custIdSuffix}-${String(idx + 1).padStart(2, '0')}`;
      }
    });

    const newCust = {
      customerId: generatedCustId,
      name: name,
      address: address,
      idCard: idCard,
      phone: phone,
      email: email,
      facebook: facebook,
      lineId: lineId,
      type: type,
      notes: notes,
      birds: birds,
      createdAt: new Date().toISOString()
    };

    appState.customers.push(newCust);
    showToast("เพิ่มข้อมูลลูกค้าและนกตัวอย่างสำเร็จ", "success");
  } else {
    // Edit Mode
    const custIndex = appState.customers.findIndex(x => x.customerId === id);
    if (custIndex !== -1) {
      // Re-map bird IDs with proper numbering
      const custIdSeq = id.split("-")[1];
      birds.forEach((b, idx) => {
        if (!b.birdId || b.birdId.startsWith("B-TMP")) {
          b.birdId = `B-${custIdSeq}-${String(idx + 1).padStart(2, '0')}`;
        }
      });

      appState.customers[custIndex] = {
        ...appState.customers[custIndex],
        name: name,
        address: address,
        idCard: idCard,
        phone: phone,
        email: email,
        facebook: facebook,
        lineId: lineId,
        type: type,
        notes: notes,
        birds: birds
      };
      showToast("แก้ไขข้อมูลลูกค้าเรียบร้อยแล้ว", "success");
    }
  }

  saveCustomersToLocal();
  syncTableToSheets("customers");
  closeModal("customer-form-modal");
  renderCustomersList();
}

// ----------------------------------------------------
// Page: Bird Sample Registration & List
// ----------------------------------------------------
function renderSamplesList() {
  const tbody = document.getElementById("samples-list-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filterSex = document.getElementById("filter-bird-sex").value;
  const filterStatus = document.getElementById("filter-bird-status").value;
  const searchVal = document.getElementById("search-bird-input").value.toLowerCase().trim();
  const filterDate = document.getElementById("filter-bird-date").value;
  const limit = parseInt(document.getElementById("limit-bird-rows").value) || 30;

  let birdsList = [];
  appState.customers.forEach(c => {
    c.birds.forEach(b => {
      const birdDate = b.inspectedDate ? b.inspectedDate.substring(0, 10) : (c.createdAt ? c.createdAt.substring(0, 10) : "");
      birdsList.push({
        ...b,
        ownerId: c.customerId,
        ownerName: c.name,
        ownerPhone: c.phone,
        ownerAddress: c.address,
        registeredDate: birdDate
      });
    });
  });

  if (filterSex) {
    birdsList = birdsList.filter(b => b.sex === filterSex);
  }
  if (filterStatus) {
    birdsList = birdsList.filter(b => b.status === filterStatus);
  }
  if (filterDate) {
    birdsList = birdsList.filter(b => b.registeredDate === filterDate);
  }
  if (searchVal) {
    birdsList = birdsList.filter(b => 
      b.birdId.toLowerCase().includes(searchVal) || 
      b.breed.toLowerCase().includes(searchVal) || 
      b.ownerName.toLowerCase().includes(searchVal) ||
      (b.ringId && b.ringId.toLowerCase().includes(searchVal))
    );
  }

  birdsList.sort((a,b) => new Date(b.registeredDate || 0) - new Date(a.registeredDate || 0));

  const canEdit = checkPermission("Supervisor");
  const addBtn = document.getElementById("sample-add-btn");
  if (addBtn) {
    if (canEdit) addBtn.classList.remove("hidden");
    else addBtn.classList.add("hidden");
  }

  if (birdsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-gray-500">ไม่พบตัวอย่างนกตามเงื่อนไขที่ค้นหา</td></tr>`;
    return;
  }

  const limited = birdsList.slice(0, limit);

  limited.forEach(b => {
    let statusClass = b.status === "การตรวจเสร็จสิ้น" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
    let sexHtml = "";
    if (b.sex === "Male") {
      sexHtml = `<span class="text-blue-600 dark:text-blue-400 font-semibold"><i class="fas fa-mars mr-1"></i>ตัวผู้ (♂)</span>`;
    } else if (b.sex === "Female") {
      sexHtml = `<span class="text-pink-600 dark:text-pink-400 font-semibold"><i class="fas fa-venus mr-1"></i>ตัวเมีย (♀)</span>`;
    } else {
      sexHtml = `<span class="text-gray-400">รอผลตรวจ</span>`;
    }

    const editBtnHtml = canEdit 
      ? `<button onclick="openEditBirdModal('${b.birdId}')" class="text-indigo-600 hover:underline text-xs font-semibold mr-3">แก้ไข</button>`
      : "";

    const certBtnHtml = b.status === "การตรวจเสร็จสิ้น"
      ? `<button onclick="handleCertificatePrintAction('${b.birdId}')" class="text-green-600 hover:underline text-xs font-semibold"><i class="fas fa-award mr-1"></i>ใบ Cer</button>`
      : `<span class="text-gray-300 text-xs"><i class="fas fa-award mr-1"></i>ใบ Cer</span>`;

    tbody.innerHTML += `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
        <td class="px-4 py-3 text-center">
          <input type="checkbox" class="bird-select-checkbox w-4 h-4 text-indigo-600 rounded" data-id="${b.birdId}">
        </td>
        <td class="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400 font-mono">${b.birdId}</td>
        <td class="px-4 py-3 font-semibold text-gray-900 dark:text-white">${b.breed}</td>
        <td class="px-4 py-3 font-mono text-amber-600 dark:text-amber-400 font-bold">${b.ringId || "-"}</td>
        <td class="px-4 py-3"><span class="px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 dark:bg-slate-700 dark:text-slate-200 text-xs">${b.sampleType || "ขน"}</span></td>
        <td class="px-4 py-3">${b.color || "-"}</td>
        <td class="px-4 py-3">${sexHtml}</td>
        <td class="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">${b.ownerId === "C-UNASSIGNED" ? "<span class='text-yellow-600'>ไม่มีเจ้าของ</span>" : b.ownerName}</td>
        <td class="px-4 py-3"><span class="px-2 py-0.5 text-xs font-semibold rounded-full ${statusClass}">${b.status}</span></td>
        <td class="px-4 py-3 text-center">
          <button onclick="openBirdDetailsModal('${b.birdId}')" class="text-gray-500 hover:underline text-xs font-semibold mr-3">ดูข้อมูล</button>
          ${editBtnHtml}
          ${certBtnHtml}
        </td>
      </tr>
    `;
  });
}

function toggleSelectAllBirds(master) {
  const checkboxes = document.querySelectorAll(".bird-select-checkbox");
  checkboxes.forEach(cb => cb.checked = master.checked);
}

function openSelectedBirdsPreview() {
  const checkboxes = document.querySelectorAll(".bird-select-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("กรุณาเลือกนกตัวอย่างอย่างน้อย 1 รายการเพื่อออกที่อยู่", "warning");
    return;
  }

  let selectedBirds = [];
  let ownerId = null;
  let ownerObj = null;

  checkboxes.forEach(cb => {
    const bId = cb.getAttribute("data-id");
    appState.customers.forEach(c => {
      const found = c.birds.find(b => b.birdId === bId);
      if (found) {
        if (!ownerId) {
          ownerId = c.customerId;
          ownerObj = c;
        }
        selectedBirds.push({
          ...found,
          ownerName: c.name
        });
      }
    });
  });

  const distinctOwners = [...new Set(selectedBirds.map(b => b.ownerName))];
  if (distinctOwners.length > 1) {
    showToast("กรุณาเลือกเฉพาะนกของเจ้าของรายเดียวกันสำหรับการส่งซองจดหมาย", "error");
    return;
  }

  document.getElementById("env-cust-name").innerText = ownerObj.name;
  document.getElementById("env-cust-address").innerText = ownerObj.address;
  document.getElementById("env-cust-phone").innerText = maskSensitiveData(ownerObj.phone, "phone");

  navigateTo("bulk-preview");
}

function openBirdDetailsModal(id) {
  let birdObj = null;
  let ownerObj = null;
  
  appState.customers.forEach(c => {
    const found = c.birds.find(b => b.birdId === id);
    if (found) {
      birdObj = found;
      ownerObj = c;
    }
  });

  if (!birdObj) return;
  appState.selectedBirdForDetail = birdObj;

  document.getElementById("det-bird-id").innerText = birdObj.birdId;
  document.getElementById("det-bird-ring-id").innerText = birdObj.ringId || "-";
  document.getElementById("det-bird-breed").innerText = birdObj.breed;
  document.getElementById("det-bird-sample-type").innerText = birdObj.sampleType || "ขน";
  document.getElementById("det-bird-color").innerText = birdObj.color || "-";
  document.getElementById("det-bird-status").innerText = birdObj.status;
  
  let sexVal = "ยังไม่ได้รับการยืนยัน";
  if (birdObj.sex === "Male") sexVal = "ตัวผู้ (Male ♂)";
  else if (birdObj.sex === "Female") sexVal = "ตัวเมีย (Female ♀)";
  document.getElementById("det-bird-sex").innerText = sexVal;

  document.getElementById("det-bird-inspected-by").innerText = birdObj.inspectedBy || "-";
  document.getElementById("det-bird-inspected-date").innerText = birdObj.inspectedDate ? new Date(birdObj.inspectedDate).toLocaleString() : "-";

  document.getElementById("det-bird-owner-id").innerText = ownerObj.customerId;
  document.getElementById("det-bird-owner-name").innerText = ownerObj.name;
  document.getElementById("det-bird-owner-phone").innerText = maskSensitiveData(ownerObj.phone, "phone");
  document.getElementById("det-bird-owner-email").innerText = maskSensitiveData(ownerObj.email, "email");
  document.getElementById("det-bird-owner-address").innerText = ownerObj.address;

  openModal("bird-detail-modal");
}

function openAddBirdModal() {
  document.getElementById("bird-form-mode").value = "add";
  document.getElementById("bird-form-id").value = "";
  document.getElementById("bird-form-breed").value = "";
  document.getElementById("bird-form-ring-id").value = "";
  document.getElementById("bird-form-sample-type").value = "ขน";
  document.getElementById("bird-form-color").value = "";
  document.getElementById("bird-form-status").value = "รอผลตรวจ";
  document.getElementById("bird-form-sex").value = "Unknown";
  document.getElementById("bird-form-sex").disabled = true;

  const ownerSelector = document.getElementById("bird-form-owner");
  ownerSelector.innerHTML = `<option value="C-UNASSIGNED">-- ยังไม่มีเจ้าของ / ฝากตรวจชั่วคราว --</option>`;
  appState.customers.filter(c => c.customerId !== "C-UNASSIGNED").forEach(c => {
    ownerSelector.innerHTML += `<option value="${c.customerId}">${c.customerId} - ${c.name}</option>`;
  });
  ownerSelector.value = "C-UNASSIGNED";
  document.getElementById("bird-form-owner-id").value = "C-UNASSIGNED";
  ownerSelector.disabled = false;

  document.getElementById("bird-modal-title").innerText = "ลงทะเบียนตัวอย่างนกใหม่";
  openModal("bird-form-modal");
}

function openEditBirdModal(birdId) {
  let birdObj = null;
  let ownerObj = null;
  
  appState.customers.forEach(c => {
    const found = c.birds.find(b => b.birdId === birdId);
    if (found) {
      birdObj = found;
      ownerObj = c;
    }
  });

  if (!birdObj) return;

  document.getElementById("bird-form-mode").value = "edit";
  document.getElementById("bird-form-id").value = birdObj.birdId;
  document.getElementById("bird-form-breed").value = birdObj.breed;
  document.getElementById("bird-form-ring-id").value = birdObj.ringId || "";
  document.getElementById("bird-form-sample-type").value = birdObj.sampleType || "ขน";
  document.getElementById("bird-form-color").value = birdObj.color || "";
  document.getElementById("bird-form-status").value = birdObj.status;
  
  const sexSelect = document.getElementById("bird-form-sex");
  sexSelect.value = birdObj.sex;
  sexSelect.disabled = birdObj.status === "รอผลตรวจ";

  const ownerSelector = document.getElementById("bird-form-owner");
  ownerSelector.innerHTML = `<option value="C-UNASSIGNED" ${ownerObj.customerId === 'C-UNASSIGNED' ? 'selected' : ''}>-- ยังไม่มีเจ้าของ / ฝากตรวจชั่วคราว --</option>`;
  appState.customers.filter(c => c.customerId !== "C-UNASSIGNED").forEach(c => {
    const isSelected = ownerObj.customerId === c.customerId ? "selected" : "";
    ownerSelector.innerHTML += `<option value="${c.customerId}" ${isSelected}>${c.customerId} - ${c.name}</option>`;
  });
  ownerSelector.value = ownerObj.customerId;
  document.getElementById("bird-form-owner-id").value = ownerObj.customerId;
  ownerSelector.disabled = false;

  document.getElementById("bird-modal-title").innerText = "แก้ไขข้อมูลตัวอย่างนก";
  openModal("bird-form-modal");
}

function handleBirdFormStatusChange(selectEl) {
  const sexSelect = document.getElementById("bird-form-sex");
  if (selectEl.value === "การตรวจเสร็จสิ้น") {
    sexSelect.disabled = false;
  } else {
    sexSelect.value = "Unknown";
    sexSelect.disabled = true;
  }
}

function saveBirdFormSubmit() {
  if (!checkPermission("Supervisor")) {
    showToast("คุณไม่มีระดับสิทธิ์ที่เหมาะสมในการแก้ไขข้อมูล", "error");
    return;
  }

  const mode = document.getElementById("bird-form-mode").value;
  const birdId = document.getElementById("bird-form-id").value;
  const ownerId = document.getElementById("bird-form-owner-id").value;
  const breed = document.getElementById("bird-form-breed").value.trim();
  const ringId = document.getElementById("bird-form-ring-id") ? document.getElementById("bird-form-ring-id").value.trim() : "";
  const sampleType = document.getElementById("bird-form-sample-type").value;
  const color = document.getElementById("bird-form-color").value.trim();
  const status = document.getElementById("bird-form-status").value;
  const sex = document.getElementById("bird-form-sex").value;

  if (!ownerId || !breed) {
    showToast("กรุณาระบุเจ้าของนกและสายพันธุ์", "warning");
    return;
  }

  // Find target customer
  const targetCustomer = appState.customers.find(c => c.customerId === ownerId);
  if (!targetCustomer) {
    showToast("ไม่พบข้อมูลเจ้าของนก", "error");
    return;
  }

  // Find original owner of this bird in state (if edit mode)
  let currentOwner = null;
  let birdIndexInCurrentOwner = -1;
  
  if (mode === "edit") {
    appState.customers.forEach(c => {
      const idx = c.birds.findIndex(b => b.birdId === birdId);
      if (idx !== -1) {
        currentOwner = c;
        birdIndexInCurrentOwner = idx;
      }
    });
  }

  if (mode === "add") {
    // Generate new bird ID
    const custSeq = ownerId === "C-UNASSIGNED" ? "UNASSIGNED" : ownerId.split("-")[1];
    const newSeqNum = targetCustomer.birds.length + 1;
    const generatedBirdId = `B-${custSeq}-${String(newSeqNum).padStart(2, '0')}`;

    let inspectedBy = "";
    let inspectedDate = "";
    if (status === "การตรวจเสร็จสิ้น") {
      inspectedBy = appState.activeUser.userId;
      inspectedDate = new Date().toISOString();
    }

    targetCustomer.birds.push({
      birdId: generatedBirdId,
      ringId: ringId,
      breed: breed,
      sampleType: sampleType,
      color: color,
      status: status,
      sex: sex,
      inspectedBy: inspectedBy,
      inspectedDate: inspectedDate,
      createdAt: new Date().toISOString()
    });
    showToast(`ลงทะเบียนตัวอย่างนก ${generatedBirdId} สำเร็จ`, "success");
  } else {
    // Edit
    if (!currentOwner) {
      showToast("ไม่พบข้อมูลนกเดิมในระบบ", "error");
      return;
    }
    
    // Find original bird object
    const bird = currentOwner.birds[birdIndexInCurrentOwner];

    let inspectedBy = bird.inspectedBy;
    let inspectedDate = bird.inspectedDate;

    if (status === "การตรวจเสร็จสิ้น" && bird.status === "รอผลตรวจ") {
      inspectedBy = appState.activeUser.userId;
      inspectedDate = new Date().toISOString();
    } else if (status === "รอผลตรวจ") {
      inspectedBy = "";
      inspectedDate = "";
    }

    // Check if owner has changed
    if (currentOwner.customerId !== ownerId) {
      // Remove from current owner
      currentOwner.birds.splice(birdIndexInCurrentOwner, 1);

      // Generate new bird ID for target customer
      const custSeq = ownerId === "C-UNASSIGNED" ? "UNASSIGNED" : ownerId.split("-")[1];
      const newSeqNum = targetCustomer.birds.length + 1;
      const newBirdId = `B-${custSeq}-${String(newSeqNum).padStart(2, '0')}`;

      // Push to target customer with new ID
      targetCustomer.birds.push({
        birdId: newBirdId,
        ringId: ringId,
        breed: breed,
        sampleType: sampleType,
        color: color,
        status: status,
        sex: sex,
        inspectedBy: inspectedBy,
        inspectedDate: inspectedDate,
        createdAt: bird.createdAt || new Date().toISOString()
      });
      showToast(`ย้ายนกไปยังเจ้าของใหม่ และเปลี่ยนรหัสเป็น ${newBirdId} เรียบร้อยแล้ว`, "success");
    } else {
      // Owner is the same, just update details
      bird.breed = breed;
      bird.ringId = ringId;
      bird.sampleType = sampleType;
      bird.color = color;
      bird.status = status;
      bird.sex = sex;
      bird.inspectedBy = inspectedBy;
      bird.inspectedDate = inspectedDate;
      showToast(`อัปเดตข้อมูลนก ${birdId} สำเร็จ`, "success");
    }
  }

  saveCustomersToLocal();
  syncTableToSheets("customers");
  closeModal("bird-form-modal");
  renderSamplesList();
}

// ----------------------------------------------------
// Page: Receipts & Quotations Manager
// ----------------------------------------------------
function renderReceiptsList() {
  const tbody = document.getElementById("receipts-list-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const searchVal = document.getElementById("search-receipt-input").value.toLowerCase().trim();
  const filterDate = document.getElementById("filter-receipt-date").value;
  const limit = parseInt(document.getElementById("limit-receipt-rows").value) || 30;

  let docs = appState.receipts;
  if (filterDate) {
    docs = docs.filter(d => d.date === filterDate);
  }
  if (searchVal) {
    docs = docs.filter(d => 
      d.documentId.toLowerCase().includes(searchVal) || 
      d.customerId.toLowerCase().includes(searchVal)
    );
  }

  const canBilling = checkPermission("Manager");
  const createRBtn = document.getElementById("create-receipt-btn");
  if (createRBtn) {
    if (canBilling) createRBtn.classList.remove("hidden");
    else createRBtn.classList.add("hidden");
  }

  if (docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">ไม่พบเอกสารใบเสร็จรับเงินตามเงื่อนไขที่ค้นหา</td></tr>`;
    return;
  }

  docs = [...docs].sort((a,b) => new Date(b.date) - new Date(a.date));
  const limited = docs.slice(0, limit);

  limited.forEach(d => {
    const cust = appState.customers.find(c => c.customerId === d.customerId);
    const clientName = cust ? cust.name : "ไม่ระบุ";

    const badge = `<span class="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full dark:bg-green-900 dark:text-green-200">ใบเสร็จรับเงิน</span>`;

    const editActions = canBilling 
      ? `<button onclick="openEditDocumentModal('${d.documentId}')" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 mr-3"><i class="fas fa-edit"></i></button>`
      : "";

    tbody.innerHTML += `
      <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
        <td class="px-6 py-4 font-bold text-gray-900 dark:text-white">${d.documentId}</td>
        <td class="px-6 py-4">${d.date}</td>
        <td class="px-6 py-4 font-medium">${clientName} (${d.customerId})</td>
        <td class="px-6 py-4 font-semibold text-right">฿${d.total.toLocaleString()}</td>
        <td class="px-6 py-4 text-center">${d.status}</td>
        <td class="px-6 py-4 text-center">
          <div class="flex justify-center items-center">
            ${editActions}
            <button onclick="previewInvoiceDocument('${d.documentId}')" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 font-medium">ดูเอกสาร</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function renderQuotationsList() {
  const tbody = document.getElementById("quotations-list-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const searchVal = document.getElementById("search-quotation-input").value.toLowerCase().trim();
  const filterDate = document.getElementById("filter-quotation-date").value;
  const limit = parseInt(document.getElementById("limit-quotation-rows").value) || 30;

  let docs = appState.quotations;
  if (filterDate) {
    docs = docs.filter(d => d.date === filterDate);
  }
  if (searchVal) {
    docs = docs.filter(d => 
      d.documentId.toLowerCase().includes(searchVal) || 
      d.customerId.toLowerCase().includes(searchVal)
    );
  }

  const canBilling = checkPermission("Manager");
  const createQBtn = document.getElementById("create-quotation-btn");
  if (createQBtn) {
    if (canBilling) createQBtn.classList.remove("hidden");
    else createQBtn.classList.add("hidden");
  }

  if (docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">ไม่พบเอกสารใบเสนอราคาตามเงื่อนไขที่ค้นหา</td></tr>`;
    return;
  }

  docs = [...docs].sort((a,b) => new Date(b.date) - new Date(a.date));
  const limited = docs.slice(0, limit);

  limited.forEach(d => {
    const cust = appState.customers.find(c => c.customerId === d.customerId);
    const clientName = cust ? cust.name : "ไม่ระบุ";

    const badge = `<span class="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-200">ใบเสนอราคา</span>`;

    const editActions = canBilling 
      ? `<button onclick="openEditDocumentModal('${d.documentId}')" class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 mr-3"><i class="fas fa-edit"></i></button>`
      : "";

    tbody.innerHTML += `
      <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
        <td class="px-6 py-4 font-bold text-gray-900 dark:text-white">${d.documentId}</td>
        <td class="px-6 py-4">${d.date}</td>
        <td class="px-6 py-4 font-medium">${clientName} (${d.customerId})</td>
        <td class="px-6 py-4 font-semibold text-right">฿${d.total.toLocaleString()}</td>
        <td class="px-6 py-4 text-center">${d.status}</td>
        <td class="px-6 py-4 text-center">
          <div class="flex justify-center items-center">
            ${editActions}
            <button onclick="previewInvoiceDocument('${d.documentId}')" class="text-gray-600 hover:text-gray-900 dark:text-gray-300 font-medium">ดูเอกสาร</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function openCreateDocModal(type) {
  document.getElementById("doc-form-mode").value = "add";
  document.getElementById("doc-form-type").value = type;
  document.getElementById("doc-modal-title").innerText = type === "Receipt" ? "สร้างใบเสร็จรับเงินใหม่" : "สร้างใบเสนอราคาใหม่";

  // Generate running number
  const nextId = generateRunningNumber(type);
  document.getElementById("doc-form-id").value = nextId;

  // Date picker to today
  document.getElementById("doc-form-date").value = new Date().toISOString().substring(0, 10);

  // Set default discount
  document.getElementById("doc-form-discount").value = "0";

  // Build owner selector dropdown
  const ownerSelector = document.getElementById("doc-form-owner");
  ownerSelector.innerHTML = `<option value="">-- เลือกข้อมูลลูกค้า * --</option>`;
  appState.customers.forEach(c => {
    ownerSelector.innerHTML += `<option value="${c.customerId}">${c.customerId} - ${c.name}</option>`;
  });
  ownerSelector.disabled = false;

  // Reset lines
  document.getElementById("doc-form-lines-container").innerHTML = "";
  document.getElementById("doc-form-total-sum").innerText = "฿0";

  // Handle Quotation linking panel
  const linkPanel = document.getElementById("doc-form-quotation-link-panel");
  const linkSelect = document.getElementById("doc-form-quotation-link");
  if (type === "Receipt") {
    linkPanel.classList.remove("hidden");
    // Build active approved quotations options
    linkSelect.innerHTML = `<option value="">-- ไม่เชื่อมโยง (เพิ่มรายการเอง) --</option>`;
    appState.quotations.forEach(q => {
      linkSelect.innerHTML += `<option value="${q.documentId}">${q.documentId} (ลูกค้า ${q.customerId} - ฿${q.total})</option>`;
    });
  } else {
    linkPanel.classList.add("hidden");
    linkSelect.innerHTML = "";
  }

  openModal("document-form-modal");
}

function openEditDocumentModal(docId) {
  const doc = appState.receipts.find(d => d.documentId === docId) || appState.quotations.find(d => d.documentId === docId);
  if (!doc) return;

  document.getElementById("doc-form-mode").value = "edit";
  document.getElementById("doc-form-type").value = doc.type;
  document.getElementById("doc-form-id").value = doc.documentId;
  document.getElementById("doc-form-date").value = doc.date;
  document.getElementById("doc-form-discount").value = doc.discount;

  const ownerSelector = document.getElementById("doc-form-owner");
  const cust = appState.customers.find(c => c.customerId === doc.customerId);
  ownerSelector.innerHTML = `<option value="${doc.customerId}" selected>${doc.customerId} - ${cust ? cust.name : doc.customerId}</option>`;
  ownerSelector.disabled = true;

  // Hide quotation linking when editing existing
  document.getElementById("doc-form-quotation-link-panel").classList.add("hidden");

  // Render items
  const container = document.getElementById("doc-form-lines-container");
  container.innerHTML = "";
  doc.items.forEach(item => {
    addDocumentLineRow(item);
  });

  document.getElementById("doc-modal-title").innerText = doc.type === "Receipt" ? "แก้ไขข้อมูลใบเสร็จ" : "แก้ไขข้อมูลใบเสนอราคา";
  recalcDocumentTotals();
  openModal("document-form-modal");
}

function handleLinkQuotationChange(selectEl) {
  const qId = selectEl.value;
  if (!qId) return;

  const q = appState.quotations.find(d => d.documentId === qId);
  if (!q) return;

  // Set owner customer (match quotation)
  const ownerSelector = document.getElementById("doc-form-owner");
  ownerSelector.value = q.customerId;
  ownerSelector.disabled = true; // Lock it

  // Copy discount
  document.getElementById("doc-form-discount").value = q.discount;

  // Import lines
  const container = document.getElementById("doc-form-lines-container");
  container.innerHTML = "";
  q.items.forEach(item => {
    addDocumentLineRow({
      birdId: item.birdId,
      breed: item.breed,
      qty: item.qty,
      unit: item.unit,
      price: item.price,
      discount: item.discount
    });
  });

  recalcDocumentTotals();
}

function handleDocOwnerChange(selectEl) {
  // If owner changes, clear lines because birds belong to specific customers
  document.getElementById("doc-form-lines-container").innerHTML = "";
  recalcDocumentTotals();
}

function addDocumentLineRow(itemData = null) {
  const ownerId = document.getElementById("doc-form-owner").value;
  if (!ownerId) {
    showToast("กรุณาเลือกข้อมูลลูกค้าก่อนเพิ่มรายการสินค้า", "warning");
    return;
  }

  const cust = appState.customers.find(c => c.customerId === ownerId);
  if (!cust) return;

  const container = document.getElementById("doc-form-lines-container");
  const div = document.createElement("div");
  div.className = "grid grid-cols-1 md:grid-cols-6 gap-3 items-end bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 mb-2";

  // Build bird options dropdown from owner's bird registry
  let birdOptions = `<option value="">-- ไม่เชื่อมโยงนก --</option>`;
  cust.birds.forEach(b => {
    const isSelected = itemData && itemData.birdId === b.birdId ? "selected" : "";
    birdOptions += `<option value="${b.birdId}" ${isSelected}>${b.birdId} - ${b.breed}</option>`;
  });

  div.innerHTML = `
    <div class="col-span-2">
      <label class="block text-xs font-semibold mb-1 text-gray-500">ชื่อสินค้า / นกตัวอย่าง *</label>
      <select name="line-bird-id" class="w-full text-xs p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" onchange="autoFillDocLineDetails(this)">
        ${birdOptions}
      </select>
      <input type="text" name="line-breed" value="${itemData ? itemData.breed : ''}" placeholder="สายพันธุ์นก (ถ้าไม่ได้เลือกรหัส)" required class="mt-1 w-full text-xs p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
    </div>
    <div>
      <label class="block text-xs font-semibold mb-1 text-gray-500">จำนวน *</label>
      <input type="number" name="line-qty" min="1" value="${itemData ? itemData.qty : 1}" oninput="recalcDocumentTotals()" class="w-full text-xs p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
    </div>
    <div>
      <label class="block text-xs font-semibold mb-1 text-gray-500">หน่วย</label>
      <input type="text" name="line-unit" value="${itemData ? itemData.unit : 'ตัว'}" class="w-full text-xs p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
    </div>
    <div>
      <label class="block text-xs font-semibold mb-1 text-gray-500">ราคาต่อหน่วย (฿) *</label>
      <input type="number" name="line-price" min="0" value="${itemData ? itemData.price : 500}" oninput="recalcDocumentTotals()" class="w-full text-xs p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
    </div>
    <div class="flex justify-between items-center space-x-2">
      <div class="flex-1">
        <label class="block text-xs font-semibold mb-1 text-gray-500">ส่วนลด (฿)</label>
        <input type="number" name="line-discount" min="0" value="${itemData ? itemData.discount : 0}" oninput="recalcDocumentTotals()" class="w-full text-xs p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
      </div>
      <button type="button" onclick="this.parentElement.parentElement.remove(); recalcDocumentTotals();" class="text-red-500 hover:text-red-700 p-2"><i class="fas fa-trash"></i></button>
    </div>
  `;
  container.appendChild(div);
  recalcDocumentTotals();
}

function autoFillDocLineDetails(selectEl) {
  const bId = selectEl.value;
  const parent = selectEl.closest(".col-span-2").parentElement;
  const breedInput = parent.querySelector("input[name='line-breed']");
  
  if (bId) {
    // Find bird details
    let foundBreed = "";
    appState.customers.forEach(c => {
      const b = c.birds.find(x => x.birdId === bId);
      if (b) foundBreed = b.breed;
    });
    breedInput.value = foundBreed;
  }
}

function recalcDocumentTotals() {
  const container = document.getElementById("doc-form-lines-container");
  const rows = container.children;
  let subtotal = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const qty = parseFloat(row.querySelector("input[name='line-qty']").value) || 0;
    const price = parseFloat(row.querySelector("input[name='line-price']").value) || 0;
    const discount = parseFloat(row.querySelector("input[name='line-discount']").value) || 0;
    
    subtotal += (qty * price) - discount;
  }

  const overallDiscount = parseFloat(document.getElementById("doc-form-discount").value) || 0;
  const finalTotal = Math.max(0, subtotal - overallDiscount);

  document.getElementById("doc-form-total-sum").innerText = "฿" + finalTotal.toLocaleString();
}

function saveDocumentFormSubmit() {
  if (!checkPermission("Manager")) {
    showToast("คุณไม่มีสิทธิ์ในการจัดการเอกสารทางการเงิน", "error");
    return;
  }

  const mode = document.getElementById("doc-form-mode").value;
  const type = document.getElementById("doc-form-type").value;
  const docId = document.getElementById("doc-form-id").value;
  const date = document.getElementById("doc-form-date").value;
  const customerId = document.getElementById("doc-form-owner").value;
  const overallDiscount = parseFloat(document.getElementById("doc-form-discount").value) || 0;
  const linkedQId = document.getElementById("doc-form-quotation-link") ? document.getElementById("doc-form-quotation-link").value : "";

  if (!customerId || !date) {
    showToast("กรุณากรอกข้อมูลลูกค้าและวันที่ให้ครบถ้วน", "warning");
    return;
  }

  // Gather items
  const container = document.getElementById("doc-form-lines-container");
  const rows = container.children;
  const items = [];
  let subtotal = 0;

  if (rows.length === 0) {
    showToast("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ", "warning");
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const birdId = row.querySelector("select[name='line-bird-id']").value;
    const breed = row.querySelector("input[name='line-breed']").value.trim();
    const qty = parseFloat(row.querySelector("input[name='line-qty']").value) || 0;
    const unit = row.querySelector("input[name='line-unit']").value.trim();
    const price = parseFloat(row.querySelector("input[name='line-price']").value) || 0;
    const discount = parseFloat(row.querySelector("input[name='line-discount']").value) || 0;

    if (!breed || qty <= 0 || price < 0) {
      showToast("กรุณากรอกสายพันธุ์ จำนวน และราคา ให้ถูกต้อง", "warning");
      return;
    }

    const itemTotal = (qty * price) - discount;
    subtotal += itemTotal;

    items.push({
      birdId: birdId,
      breed: breed,
      qty: qty,
      unit: unit,
      price: price,
      discount: discount,
      total: itemTotal
    });
  }

  const finalTotal = Math.max(0, subtotal - overallDiscount);

  if (mode === "add") {
    // Avoid document ID collisions
    const listToCheck = type === "Receipt" ? appState.receipts : appState.quotations;
    if (listToCheck.some(r => r.documentId === docId)) {
      showToast("รหัสเอกสารซ้ำในระบบ กรุณาลองใหม่อีกครั้ง", "error");
      return;
    }

    const newDoc = {
      documentId: docId,
      type: type,
      date: date,
      customerId: customerId,
      items: items,
      discount: overallDiscount,
      total: finalTotal,
      linkedQuotationId: linkedQId,
      status: type === "Receipt" ? "Paid" : "อนุมัติแล้ว",
      createdAt: new Date().toISOString()
    };

    if (type === "Receipt") {
      appState.receipts.push(newDoc);
      // Update Quotation status to linked if applicable
      if (linkedQId) {
        const qIndex = appState.quotations.findIndex(r => r.documentId === linkedQId);
        if (qIndex !== -1) {
          appState.quotations[qIndex].status = "ออกใบเสร็จแล้ว";
          saveQuotationsToLocal();
        }
      }
      saveReceiptsToLocal();
      syncTableToSheets("receipts");
    } else {
      appState.quotations.push(newDoc);
      saveQuotationsToLocal();
      syncTableToSheets("receipts");
    }

    showToast(`ออกเอกสาร ${docId} สำเร็จ`, "success");
  } else {
    // Edit Mode
    if (type === "Receipt") {
      const idx = appState.receipts.findIndex(r => r.documentId === docId);
      if (idx !== -1) {
        appState.receipts[idx] = {
          ...appState.receipts[idx],
          date: date,
          items: items,
          discount: overallDiscount,
          total: finalTotal
        };
        saveReceiptsToLocal();
        syncTableToSheets("receipts");
        showToast(`อัปเดตเอกสาร ${docId} เรียบร้อยแล้ว`, "success");
      }
    } else {
      const idx = appState.quotations.findIndex(r => r.documentId === docId);
      if (idx !== -1) {
        appState.quotations[idx] = {
          ...appState.quotations[idx],
          date: date,
          items: items,
          discount: overallDiscount,
          total: finalTotal
        };
        saveQuotationsToLocal();
        syncTableToSheets("receipts");
        showToast(`อัปเดตเอกสาร ${docId} เรียบร้อยแล้ว`, "success");
      }
    }
  }

  closeModal("document-form-modal");
  if (type === "Receipt") {
    renderReceiptsList();
  } else {
    renderQuotationsList();
  }
}

// ----------------------------------------------------
// Page: Finance Controller (Income/Expenses)
// ----------------------------------------------------
function renderFinance() {
  // Income calculations
  const totalIncome = appState.receipts
    .filter(r => r.type === "Receipt" && r.status === "Paid")
    .reduce((sum, r) => sum + r.total, 0);

  // Expense calculations
  const totalExpense = appState.financeExpenses.reduce((sum, e) => sum + e.amount, 0);

  const profit = totalIncome - totalExpense;

  document.getElementById("fin-total-income").innerText = "฿" + totalIncome.toLocaleString();
  document.getElementById("fin-total-expense").innerText = "฿" + totalExpense.toLocaleString();
  
  const profitEl = document.getElementById("fin-net-profit");
  profitEl.innerText = "฿" + profit.toLocaleString();
  if (profit >= 0) {
    profitEl.className = "text-2xl font-bold text-green-600 dark:text-green-400";
  } else {
    profitEl.className = "text-2xl font-bold text-red-600 dark:text-red-400";
  }

  // Load transactions list (Revenues + Expenses combined)
  const tbody = document.getElementById("fin-transactions-tbody");
  tbody.innerHTML = "";

  const txList = [];
  // 1. Receipts (Incomes)
  appState.receipts.filter(r => r.type === "Receipt" && r.status === "Paid").forEach(r => {
    txList.push({
      id: r.documentId,
      type: "Income",
      date: r.date,
      description: `ค่าตรวจเพศนกตามใบเสร็จ ${r.documentId}`,
      amount: r.total
    });
  });

  // 2. Direct Expenses
  appState.financeExpenses.forEach(e => {
    txList.push({
      id: e.id,
      type: "Expense",
      date: e.date,
      description: e.description,
      amount: e.amount
    });
  });

  // Sort transactions by date descending
  txList.sort((a,b) => new Date(b.date) - new Date(a.date));

  if (txList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">ไม่มีประวัติการทำธุรกรรมทางการเงิน</td></tr>`;
  } else {
    txList.forEach(t => {
      let incomeVal = "-";
      let expenseVal = "-";
      if (t.type === "Income") {
        incomeVal = `<span class="text-green-600 dark:text-green-400 font-bold">+฿${t.amount.toLocaleString()}</span>`;
      } else {
        expenseVal = `<span class="text-red-600 dark:text-red-400 font-bold">-฿${t.amount.toLocaleString()}</span>`;
      }

      tbody.innerHTML += `
        <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
          <td class="px-6 py-4 font-bold text-gray-900 dark:text-white">${t.id}</td>
          <td class="px-6 py-4">${t.date}</td>
          <td class="px-6 py-4 text-sm">${t.description}</td>
          <td class="px-6 py-4 text-right">${incomeVal}</td>
          <td class="px-6 py-4 text-right">${expenseVal}</td>
        </tr>
      `;
    });
  }
}

function openAddExpenseModal() {
  if (!checkPermission("Manager")) {
    showToast("คุณไม่มีระดับสิทธิ์การเงินเพื่อแก้ไขบัญชี", "error");
    return;
  }
  document.getElementById("exp-form-desc").value = "";
  document.getElementById("exp-form-amount").value = "";
  document.getElementById("exp-form-date").value = new Date().toISOString().substring(0,10);
  document.getElementById("exp-form-category").value = "Supply";

  openModal("expense-form-modal");
}

function saveExpenseFormSubmit() {
  if (!checkPermission("Manager")) return;

  const desc = document.getElementById("exp-form-desc").value.trim();
  const amount = parseFloat(document.getElementById("exp-form-amount").value) || 0;
  const date = document.getElementById("exp-form-date").value;
  const category = document.getElementById("exp-form-category").value;

  if (!desc || amount <= 0 || !date) {
    showToast("กรุณากรอกคำอธิบายและจำนวนเงินให้ถูกต้อง", "warning");
    return;
  }

  const generatedId = `EXP-${new Date().getTime().toString().slice(-4)}`;
  const newExp = {
    id: generatedId,
    description: desc,
    amount: amount,
    date: date,
    category: category
  };

  appState.financeExpenses.push(newExp);
  saveExpensesToLocal();
  
  showToast("บันทึกค่าใช้จ่ายเรียบร้อยแล้ว", "success");
  closeModal("expense-form-modal");
  renderFinance();
}

// ----------------------------------------------------
// Page: Daily Reports
// ----------------------------------------------------
function renderReports() {
  const container = document.getElementById("reports-container");
  container.innerHTML = "";

  const reportDate = document.getElementById("report-date-picker").value;
  if (!reportDate) return;

  // Filter items matching the chosen reportDate
  const matchingCustomers = appState.customers.filter(c => c.createdAt && c.createdAt.startsWith(reportDate));
  
  const matchingBirds = [];
  appState.customers.forEach(c => {
    c.birds.forEach(b => {
      // If inspected date matches reportDate, or if registered date matches
      const dateToCheck = b.inspectedDate ? b.inspectedDate.substring(0, 10) : (c.createdAt ? c.createdAt.substring(0, 10) : "");
      if (dateToCheck === reportDate) {
        matchingBirds.push({
          ...b,
          ownerName: c.name
        });
      }
    });
  });

  const matchingReceipts = appState.receipts.filter(r => r.type === "Receipt" && r.status === "Paid" && r.date === reportDate);
  const totalRevenue = matchingReceipts.reduce((sum, r) => sum + r.total, 0);

  // Render HTML structure for the daily report
  let customerListHtml = "";
  if (matchingCustomers.length === 0) {
    customerListHtml = `<p class="text-sm text-gray-500 italic">ไม่มีข้อมูลการลงทะเบียนลูกค้าใหม่ในวันนี้</p>`;
  } else {
    customerListHtml = `<ul class="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">`;
    matchingCustomers.forEach(c => {
      customerListHtml += `<li>${c.customerId} - ${c.name} (${c.type})</li>`;
    });
    customerListHtml += `</ul>`;
  }

  let birdListHtml = "";
  if (matchingBirds.length === 0) {
    birdListHtml = `<p class="text-sm text-gray-500 italic">ไม่มีตัวอย่างที่ดำเนินการหรือตรวจวิเคราะห์เสร็จสิ้นในวันนี้</p>`;
  } else {
    birdListHtml = `
      <table class="w-full text-left border-collapse text-xs mt-2">
        <thead>
          <tr class="bg-gray-100 dark:bg-gray-700">
            <th class="p-2 border border-gray-200">รหัสตัวอย่าง</th>
            <th class="p-2 border border-gray-200">สายพันธุ์</th>
            <th class="p-2 border border-gray-200">เพศ</th>
            <th class="p-2 border border-gray-200">สถานะ</th>
            <th class="p-2 border border-gray-200">ผู้ส่ง / เจ้าของ</th>
          </tr>
        </thead>
        <tbody>
    `;
    matchingBirds.forEach(b => {
      let genderText = b.sex === "Male" ? "ผู้ (♂)" : b.sex === "Female" ? "เมีย (♀)" : "รอตรวจ";
      birdListHtml += `
        <tr>
          <td class="p-2 border border-gray-200 font-bold">${b.birdId}</td>
          <td class="p-2 border border-gray-200">${b.breed}</td>
          <td class="p-2 border border-gray-200">${genderText}</td>
          <td class="p-2 border border-gray-200">${b.status}</td>
          <td class="p-2 border border-gray-200">${b.ownerName}</td>
        </tr>
      `;
    });
    birdListHtml += `</tbody></table>`;
  }

  let financeHtml = "";
  if (matchingReceipts.length === 0) {
    financeHtml = `<p class="text-sm text-gray-500 italic">ไม่มีการออกใบเสร็จรับเงินในวันนี้</p>`;
  } else {
    financeHtml = `<ul class="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">`;
    matchingReceipts.forEach(r => {
      financeHtml += `<li>${r.documentId} - ยอดชำระ: ฿${r.total.toLocaleString()} (ลูกค้า ${r.customerId})</li>`;
    });
    financeHtml += `</ul>`;
  }

  // Export logs for report date
  const matchingExportLogs = (appState.exportLogs || []).filter(l => l.timestamp && l.timestamp.startsWith(reportDate));

  let exportLogsHtml = "";
  if (matchingExportLogs.length === 0) {
    exportLogsHtml = `<p class="text-sm text-gray-500 italic">ไม่มีข้อมูลการส่งออกเอกสารในวันนี้</p>`;
  } else {
    exportLogsHtml = `
      <table class="w-full text-left border-collapse text-xs mt-2">
        <thead>
          <tr class="bg-gray-100 dark:bg-gray-700">
            <th class="p-2 border border-gray-200">เวลา</th>
            <th class="p-2 border border-gray-200">ผู้ดำเนินการ</th>
            <th class="p-2 border border-gray-200">เลขที่เอกสาร</th>
            <th class="p-2 border border-gray-200">ประเภท</th>
            <th class="p-2 border border-gray-200">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
    `;
    matchingExportLogs.forEach(l => {
      const timeStr = new Date(l.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      let actionBadge = l.actionType === "Print"
        ? `<span class="px-2 py-0.5 text-xs font-semibold text-indigo-800 bg-indigo-150 rounded dark:bg-indigo-900 dark:text-indigo-200">พิมพ์</span>`
        : `<span class="px-2 py-0.5 text-xs font-semibold text-green-800 bg-green-150 rounded dark:bg-green-900 dark:text-green-200">PDF</span>`;

      exportLogsHtml += `
        <tr>
          <td class="p-2 border border-gray-200">${timeStr} น.</td>
          <td class="p-2 border border-gray-200">${l.userName} (${l.userId})</td>
          <td class="p-2 border border-gray-200 font-bold">${l.docId}</td>
          <td class="p-2 border border-gray-200">${l.docType}</td>
          <td class="p-2 border border-gray-200">${actionBadge}</td>
        </tr>
      `;
    });
    exportLogsHtml += `</tbody></table>`;
  }

  container.innerHTML = `
    <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
        <div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">รายงานกิจกรรมประจำวัน</h3>
          <p class="text-sm text-gray-400">ประจำวันที่ ${reportDate}</p>
        </div>
        <div class="mt-2 md:mt-0 bg-indigo-50 text-indigo-800 font-bold px-4 py-2 rounded-lg dark:bg-indigo-900 dark:text-indigo-200 text-sm">
          รายรับรวมวันนี้: ฿${totalRevenue.toLocaleString()}
        </div>
      </div>

      <div class="space-y-6">
        <div>
          <h4 class="font-bold text-gray-700 dark:text-gray-300 mb-2 border-l-4 border-blue-500 pl-2">1. ลูกค้าใหม่ที่ลงทะเบียน (${matchingCustomers.length} ราย)</h4>
          ${customerListHtml}
        </div>

        <div>
          <h4 class="font-bold text-gray-700 dark:text-gray-300 mb-2 border-l-4 border-indigo-500 pl-2">2. ตัวอย่างนกวิเคราะห์ผลวิจัย (${matchingBirds.length} ตัวอย่าง)</h4>
          ${birdListHtml}
        </div>

        <div>
          <h4 class="font-bold text-gray-700 dark:text-gray-300 mb-2 border-l-4 border-green-500 pl-2">3. สรุปธุรกรรมการเงินวันนี้</h4>
          ${financeHtml}
        </div>

        <div>
          <h4 class="font-bold text-gray-700 dark:text-gray-300 mb-2 border-l-4 border-yellow-500 pl-2">4. ประวัติการพิมพ์และส่งออกเอกสารวันนี้ (${matchingExportLogs.length} ครั้ง)</h4>
          ${exportLogsHtml}
        </div>
      </div>
      
      <div class="flex justify-end mt-8 border-t border-gray-100 dark:border-gray-700 pt-4">
        <button onclick="window.print()" class="bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-lg hover:bg-indigo-700 shadow-md">
          <i class="fas fa-print mr-2"></i>พิมพ์รายงานประจำวัน
        </button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// Page: Admin Promotion/Demotion settings view
// ----------------------------------------------------
function renderAdmins() {
  const container = document.getElementById("admins-list-container");
  container.innerHTML = "";

  const canManage = checkPermission("Director");
  const addAdminForm = document.getElementById("add-admin-form-panel");
  
  if (addAdminForm) {
    if (canManage) addAdminForm.classList.remove("hidden");
    else addAdminForm.classList.add("hidden");
  }

  if (appState.users.length === 0) {
    container.innerHTML = `<p class="text-sm text-gray-500 text-center py-4">ไม่มีรายชื่อแอดมินในระบบ</p>`;
    return;
  }

  // Active user hierarchy details
  const activeUserRank = TIER_RANK[appState.activeUser.tier] || 0;

  appState.users.forEach(u => {
    const targetUserRank = TIER_RANK[u.tier] || 0;
    
    // Permission rules:
    // - Super Admin can change ANY tier.
    // - Director can change tiers for users whose rank is LESS than Director.
    // - Others cannot change tiers.
    const isChangeAllowed = appState.activeUser.tier === "Super admin" || 
      (appState.activeUser.tier === "Director" && targetUserRank < 4);

    let selectOptions = "";
    ["Common", "Supervisor", "Manager", "Director", "Super admin"].forEach(t => {
      // Director cannot promote someone to Super Admin or Director
      if (appState.activeUser.tier === "Director" && TIER_RANK[t] >= 4) return;
      const isSelected = u.tier === t ? "selected" : "";
      selectOptions += `<option value="${t}" ${isSelected}>${t}</option>`;
    });

    const tierControlHtml = `<span class="text-sm font-semibold text-gray-500 dark:text-gray-400">เจ้าหน้าที่ระบบ</span>`;

    container.innerHTML += `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm dark:bg-gray-800 dark:border-gray-700 mb-3">
        <div class="flex items-center space-x-3 mb-2 md:mb-0">
          <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-lg dark:bg-indigo-900 dark:text-indigo-200">
            ${u.name[0]}
          </div>
          <div>
            <h4 class="font-bold text-gray-900 dark:text-white">${u.name}</h4>
            <p class="text-xs text-gray-400">UserID: ${u.userId}</p>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-xs text-gray-400">ระดับสิทธิ์:</span>
          ${tierControlHtml}
        </div>
      </div>
    `;
  });
}

function handleAddAdminSubmit() {
  if (!checkPermission("Director")) {
    showToast("คุณไม่มีระดับสิทธิ์ที่เหมาะสมในการแต่งตั้งแอดมิน", "error");
    return;
  }

  const userId = document.getElementById("admin-new-userid").value.toLowerCase().trim();
  const password = document.getElementById("admin-new-password").value;
  const name = document.getElementById("admin-new-name").value.trim();
  const tier = "Supervisor"; // Default tier for compatibility

  if (!userId || !password || !name) {
    showToast("กรุณากรอกข้อมูลบัญชีให้ครบถ้วน", "warning");
    return;
  }

  // Prevent collisions
  if (appState.users.some(u => u.userId.toLowerCase().trim() === userId)) {
    showToast("มีบัญชีผู้ใช้งานนี้ในระบบแล้ว", "error");
    return;
  }

  // Director validation
  if (appState.activeUser.tier === "Director" && TIER_RANK[tier] >= 4) {
    showToast("Director ไม่สามารถแต่งตั้งยศระดับเดียวกันหรือสูงกว่าได้", "error");
    return;
  }

  const newUser = {
    userId: userId,
    password: password,
    name: name,
    tier: tier,
    createdAt: new Date().toISOString()
  };

  appState.users.push(newUser);
  saveUsersToLocal();
  
  // Try sync
  if (appState.settings.syncEnabled && appState.settings.gasUrl) {
    fetch(appState.settings.gasUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "registerUser", data: newUser })
    }).catch(e => console.error(e));
  }

  showToast("แต่งตั้งบัญชีแอดมินเรียบร้อยแล้ว", "success");
  
  // Clear inputs
  document.getElementById("admin-new-userid").value = "";
  document.getElementById("admin-new-password").value = "";
  document.getElementById("admin-new-name").value = "";

  renderAdmins();
}

function updateUserTierAction(targetUserId, newTier) {
  if (!checkPermission("Director")) {
    showToast("คุณไม่มีสิทธิ์เพื่อเลื่อนขั้น/ลดขั้น", "error");
    return;
  }

  const user = appState.users.find(u => u.userId === targetUserId);
  if (!user) return;

  const targetUserRank = TIER_RANK[user.tier] || 0;

  // Director validation
  if (appState.activeUser.tier === "Director" && targetUserRank >= 4) {
    showToast("Director ไม่มีสิทธิ์แตะต้องยศระดับเดียวกันหรือสูงกว่าได้", "error");
    renderAdmins();
    return;
  }

  // Prevent self-demotion of the active superadmin
  if (targetUserId === appState.activeUser.userId) {
    showToast("ไม่สามารถลดขั้นตนเองผ่านเมนูแอดมินได้", "error");
    renderAdmins();
    return;
  }

  user.tier = newTier;
  saveUsersToLocal();

  // Try sync
  if (appState.settings.syncEnabled && appState.settings.gasUrl) {
    fetch(appState.settings.gasUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "updateUserTier", data: { userId: targetUserId, tier: newTier } })
    }).catch(e => console.error(e));
  }

  showToast(`ปรับระดับสิทธิ์ของ ${user.name} เป็น ${newTier} เรียบร้อย`, "success");
  renderAdmins();
}

// ----------------------------------------------------
// Page: Profile Settings
// ----------------------------------------------------
function renderProfile() {
  document.getElementById("prof-name-input").value = appState.activeUser.name;
  document.getElementById("prof-old-pass").value = "";
  document.getElementById("prof-new-pass").value = "";

  // Render sheets settings
  document.getElementById("settings-sheet-id").value = appState.settings.sheetId;
  document.getElementById("settings-gas-url").value = appState.settings.gasUrl;
  document.getElementById("settings-sync-enabled").checked = appState.settings.syncEnabled;
}

function handleProfileUpdateSubmit() {
  const newName = document.getElementById("prof-name-input").value.trim();
  const oldPass = document.getElementById("prof-old-pass").value;
  const newPass = document.getElementById("prof-new-pass").value;

  if (!newName) {
    showToast("กรุณากรอกชื่อผู้ใช้งาน", "warning");
    return;
  }

  const user = appState.users.find(u => u.userId === appState.activeUser.userId);
  if (!user) return;

  // Name update
  user.name = newName;
  appState.activeUser.name = newName;
  sessionStorage.setItem(STORAGE_PREFIX + "active_user", JSON.stringify(appState.activeUser));

  // Password update
  if (oldPass || newPass) {
    if (user.password !== oldPass) {
      showToast("รหัสผ่านเดิมไม่ถูกต้อง", "error");
      return;
    }
    if (newPass.length < 4) {
      showToast("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร", "warning");
      return;
    }
    user.password = newPass;
    showToast("อัปเดตชื่อผู้ใช้และเปลี่ยนรหัสผ่านสำเร็จ", "success");
  } else {
    showToast("อัปเดตข้อมูลชื่อผู้ใช้สำเร็จ", "success");
  }

  saveUsersToLocal();
  document.getElementById("user-name-display").innerText = appState.activeUser.name;
  renderProfile();
}

function saveCloudSettingsSubmit() {
  const sheetId = document.getElementById("settings-sheet-id").value.trim();
  const gasUrl = document.getElementById("settings-gas-url").value.trim();
  const syncEnabled = document.getElementById("settings-sync-enabled").checked;

  appState.settings = {
    sheetId: sheetId,
    gasUrl: gasUrl,
    syncEnabled: syncEnabled
  };

  localStorage.setItem(STORAGE_PREFIX + "settings", JSON.stringify(appState.settings));
  showToast("บันทึกการตั้งค่าการเชื่อมต่อคลาวด์แล้ว", "success");

  updateConnectionStatus();

  if (syncEnabled && gasUrl) {
    fetchFromGoogleSheets();
  }
}

// ----------------------------------------------------
// PDF & Print: Gender Test Certificate Layout
// ----------------------------------------------------
function handleCertificatePrintAction(birdId) {
  let birdObj = null;
  let ownerObj = null;

  appState.customers.forEach(c => {
    const found = c.birds.find(b => b.birdId === birdId);
    if (found) {
      birdObj = found;
      ownerObj = c;
    }
  });

  if (!birdObj) return;

  // Track active bird ID for direct PDF downloads
  appState.activePrintBirdId = birdId;

  // Rule: "ถ้ายังไม่ได้มีการตรวจ จะไม่สามารถปริ้นท์ได้" (If waiting verification, cannot print!)
  if (birdObj.status !== "การตรวจเสร็จสิ้น") {
    showToast("ไม่สามารถออกใบรับรองได้เนื่องจากตัวอย่างยังอยู่ในสถานะ 'รอผลตรวจ'", "warning");
    return;
  }

  // Render Certificate values
  document.getElementById("cert-no").innerText = birdObj.birdId.replace("B-", "CER-");
  document.getElementById("cert-date").innerText = birdObj.inspectedDate ? new Date(birdObj.inspectedDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : "-";
  document.getElementById("cert-bird-breed").innerText = birdObj.breed;
  document.getElementById("cert-sample-id-display").innerText = birdObj.birdId;
  document.getElementById("cert-bird-ring-id").innerText = birdObj.ringId || "-";

  // Sex logic output text and badges
  const resultContainer = document.getElementById("cert-sex-result");
  const signName = document.getElementById("cert-sign-name");
  
  if (birdObj.sex === "Male") {
    resultContainer.innerHTML = `
      <div class="flex flex-col items-center">
        <span class="text-sm font-extrabold text-blue-600 tracking-wider">เพศผู้ (MALE ♂) - โครโมโซม ZZ</span>
      </div>
    `;
  } else if (birdObj.sex === "Female") {
    resultContainer.innerHTML = `
      <div class="flex flex-col items-center">
        <span class="text-sm font-extrabold text-pink-600 tracking-wider">เพศเมีย (FEMALE ♀) - โครโมโซม ZW</span>
      </div>
    `;
  } else {
    resultContainer.innerHTML = `<span class="text-xs font-bold text-gray-400">ยังไม่สรุปผลตรวจ</span>`;
  } 
  
  // Look up certifier name
  const certifier = appState.users.find(u => u.userId === birdObj.inspectedBy);
  signName.innerText = certifier ? certifier.name : birdObj.inspectedBy || "ผู้ตรวจสอบที่ได้รับอนุมัติ";

  // Display Certificate view
  hideAllViewContainers();
  document.getElementById("cert-preview-view").classList.remove("hidden");
  
  // Scroll to top
  window.scrollTo(0,0);
}

function logDocumentExport(docId, docType, actionType) {
  if (!appState.exportLogs) appState.exportLogs = [];
  
  const logEntry = {
    id: `LOG-${new Date().getTime().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    userId: appState.activeUser ? appState.activeUser.userId : "system",
    userName: appState.activeUser ? appState.activeUser.name : "System",
    docId: docId,
    docType: docType, // "Certificate", "Receipt", "Quotation"
    actionType: actionType // "Print", "PDF Download"
  };
  
  appState.exportLogs.unshift(logEntry);
  localStorage.setItem(STORAGE_PREFIX + "export_logs", JSON.stringify(appState.exportLogs));
}

function printCertificateDocument() {
  const certNumber = document.getElementById("cert-no").innerText;
  logDocumentExport(certNumber, "Certificate", "Print");
  
  // Set print page title for PDF filename standard format
  const originalTitle = document.title;
  document.title = `Certificate-${certNumber}`;
  
  window.print();
  
  // Restore title
  document.title = originalTitle;
}

// ----------------------------------------------------
// PDF & Print: Receipts / Invoices Layout
// ----------------------------------------------------


function previewInvoiceDocument(docId) {
  let doc = appState.receipts.find(d => d.documentId === docId);
  if (!doc) {
    doc = appState.quotations.find(d => d.documentId === docId);
  }
  if (!doc) return;
  appState.selectedDocForDetail = doc;

  const col1Label = document.getElementById("print-footer-col1-label");
  const col2Container = document.getElementById("print-footer-col2");
  const footerContainer = document.getElementById("print-footer-signatures");

  if (doc.type === "Quotation") {
    if (col1Label) col1Label.innerText = "ผู้จัดทำใบเสนอราคา";
    if (col2Container) col2Container.classList.add("hidden");
    if (footerContainer) {
      footerContainer.className = "grid grid-cols-1 gap-8 mt-16 pt-8 border-t border-gray-100 dark:border-gray-800 text-center max-w-xs mx-auto";
    }
  } else {
    if (col1Label) col1Label.innerText = "ผู้จัดเตรียมบิล / Prepared By";
    if (col2Container) col2Container.classList.remove("hidden");
    if (footerContainer) {
      footerContainer.className = "grid grid-cols-2 gap-8 mt-16 pt-8 border-t border-gray-100 dark:border-gray-800 text-center";
    }
  }

  const cust = appState.customers.find(c => c.customerId === doc.customerId);

  // Set top general headers
  document.getElementById("print-doc-title").innerText = doc.type === "Receipt" ? "ใบเสร็จรับเงิน / ใบกำกับภาษี (Receipt)" : "ใบเสนอราคา (Quotation)";
  document.getElementById("print-doc-number").innerText = doc.documentId;
  document.getElementById("print-doc-date").innerText = doc.date;
  
  // Billing user info
  document.getElementById("print-cust-name").innerText = cust ? cust.name : "ไม่ระบุ";
  document.getElementById("print-cust-address").innerText = cust ? cust.address : "ไม่ระบุ";
  document.getElementById("print-cust-phone").innerText = cust ? maskSensitiveData(cust.phone, "phone") : "ไม่ระบุ";
  document.getElementById("print-cust-email").innerText = cust ? maskSensitiveData(cust.email, "email") : "ไม่ระบุ";

  // Render items rows
  const tbody = document.getElementById("print-items-tbody");
  tbody.innerHTML = "";
  let subtotal = 0;

  doc.items.forEach((item, index) => {
    const itemSubtotal = item.qty * item.price;
    subtotal += itemSubtotal - item.discount;

    tbody.innerHTML += `
      <tr class="border-b dark:border-gray-700 text-sm">
        <td class="px-4 py-3 text-center">${index + 1}</td>
        <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">
          ${item.breed}
          ${item.birdId ? `<br><span class="text-xs text-gray-400 font-mono">รหัสตัวอย่าง: ${item.birdId}</span>` : ''}
        </td>
        <td class="px-4 py-3 text-center">${item.qty} ${item.unit}</td>
        <td class="px-4 py-3 text-right">฿${item.price.toLocaleString()}</td>
        <td class="px-4 py-3 text-right text-red-500">฿${item.discount.toLocaleString()}</td>
        <td class="px-4 py-3 text-right font-bold">฿${((item.qty * item.price) - item.discount).toLocaleString()}</td>
      </tr>
    `;
  });

  const finalTotal = Math.max(0, subtotal - doc.discount);

  document.getElementById("print-sum-subtotal").innerText = "฿" + subtotal.toLocaleString();
  document.getElementById("print-sum-discount").innerText = "฿" + doc.discount.toLocaleString();
  document.getElementById("print-sum-total").innerText = "฿" + finalTotal.toLocaleString();

  // Show print view page
  hideAllViewContainers();
  document.getElementById("receipt-preview-view").classList.remove("hidden");
  window.scrollTo(0,0);
}

function printReceiptDocument() {
  const docNumber = document.getElementById("print-doc-number").innerText;
  const doc = appState.selectedDocForDetail;
  logDocumentExport(docNumber, doc ? doc.type : "Receipt", "Print");
  
  // Set print page title for PDF filename matching doc number
  const originalTitle = document.title;
  document.title = `${docNumber}`;
  
  window.print();
  
  // Restore title
  document.title = originalTitle;
}

function downloadCertificatePDF() {
  const birdId = appState.activePrintBirdId;
  if (!birdId) {
    showToast("ไม่พบรหัสตัวอย่างนกที่จะออกใบรับรอง", "error");
    return;
  }

  const element = document.querySelector("#cert-preview-view .cert-paper");
  if (!element) {
    showToast("ไม่พบหน้าต่างพรีวิวใบรับรอง", "error");
    return;
  }

  const certNumber = document.getElementById("cert-no").innerText;
  logDocumentExport(certNumber, "Certificate", "PDF Download");

  const opt = {
    margin:       0,
    filename:     `Certificate-${certNumber}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2.5, useCORS: true, letterRendering: false, backgroundColor: '#ffffff' },
    jsPDF:        { unit: 'cm', format: [15, 10], orientation: 'landscape' }
  };

  showToast("กำลังสร้างไฟล์ PDF ใบรับรอง...", "info");

  html2pdf().set(opt).from(element).save()
    .then(() => {
      showToast("ดาวน์โหลดไฟล์ PDF ใบรับรองสำเร็จแล้ว", "success");
    })
    .catch(err => {
      showToast("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: " + err.toString(), "error");
    });
}

function downloadReceiptPDF() {
  const doc = appState.selectedDocForDetail;
  if (!doc) {
    showToast("ไม่พบเอกสารการออกบิลที่จะดาวน์โหลด", "error");
    return;
  }

  const element = document.querySelector("#receipt-preview-view .receipt-paper");
  if (!element) {
    showToast("ไม่พบหน้าต่างพรีวิวใบเสร็จ/ใบเสนอราคา", "error");
    return;
  }

  logDocumentExport(doc.documentId, doc.type, "PDF Download");

  const opt = {
    margin:       0.3,
    filename:     `${doc.documentId}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2.5, useCORS: true, letterRendering: false, backgroundColor: '#ffffff' },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  showToast("กำลังสร้างไฟล์ PDF เอกสารการเงิน...", "info");

  html2pdf().set(opt).from(element).save()
    .then(() => {
      showToast("ดาวน์โหลดไฟล์ PDF สำเร็จแล้ว", "success");
    })
    .catch(err => {
      showToast("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: " + err.toString(), "error");
    });
}

// ----------------------------------------------------
// Modals Helper
// ----------------------------------------------------
function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove("hidden");
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add("hidden");
}

// Close modal on click outside content
window.onclick = function(event) {
  const modals = ["customer-form-modal", "customer-detail-modal", "bird-form-modal", "bird-detail-modal", "document-form-modal", "expense-form-modal"];
  modals.forEach(mId => {
    const el = document.getElementById(mId);
    if (el && event.target === el) {
      el.classList.add("hidden");
    }
  });
};

// ----------------------------------------------------
// Flying Pigeons Canvas Animation (For Login Background)
// ----------------------------------------------------
let animationFrameId = null;
function initPigeonAnimation() {
  const canvas = document.getElementById("pigeon-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  
  // Fit size to screen
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.onresize = resizeCanvas;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  // Pigeon Particle Class
  class Pigeon {
    constructor() {
      this.reset();
      this.y = Math.random() * canvas.height; // start scattered
    }

    reset() {
      this.x = -100 - Math.random() * 200;
      this.y = canvas.height * 0.4 + Math.random() * (canvas.height * 0.6);
      this.size = 6 + Math.random() * 12; // visual scaling
      this.speedX = 1 + Math.random() * 2;
      this.speedY = -(0.2 + Math.random() * 0.8);
      this.wingSpeed = 0.08 + Math.random() * 0.08;
      this.wingAngle = Math.random() * Math.PI * 2;
      this.opacity = 0.15 + Math.random() * 0.35; // Soft translucent white pigeons
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.wingAngle += this.wingSpeed;

      // Reset when exit screen
      if (this.x > canvas.width + 100 || this.y < -50) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
      
      // Calculate dynamic wing offset
      const wingOffset = Math.sin(this.wingAngle) * this.size;

      // Draw stylized flying bird shape (pigeon)
      ctx.beginPath();
      // Head
      ctx.arc(0, 0, this.size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      // Body
      ctx.ellipse(-this.size * 0.5, this.size * 0.2, this.size * 0.9, this.size * 0.4, -0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      // Tail
      ctx.moveTo(-this.size * 1.3, this.size * 0.1);
      ctx.lineTo(-this.size * 1.8, this.size * 0.4);
      ctx.lineTo(-this.size * 1.7, -this.size * 0.1);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      // Near Wing (flapping)
      ctx.moveTo(-this.size * 0.5, 0);
      ctx.quadraticCurveTo(-this.size * 0.2, -this.size * 1.2 + wingOffset * 0.8, this.size * 0.3, -this.size * 1.6 + wingOffset);
      ctx.quadraticCurveTo(-this.size * 0.1, -this.size * 0.5, -this.size * 0.5, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  const pigeons = Array.from({ length: 10 }, () => new Pigeon());

  function animate() {
    // Elegant deep linear gradient background already defined in Tailwind container
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pigeons.forEach(p => {
      p.update();
      p.draw();
    });

    animationFrameId = requestAnimationFrame(animate);
  }
  
  animate();
}

// ----------------------------------------------------
// Billing Bird Multi-Selection Modal
// ----------------------------------------------------
function openDocBirdSelectModal() {
  const ownerId = document.getElementById("doc-form-owner").value;
  if (!ownerId) {
    showToast("กรุณาเลือกข้อมูลลูกค้าก่อนเลือกนก", "warning");
    return;
  }

  const cust = appState.customers.find(c => c.customerId === ownerId);
  if (!cust) {
    showToast("ไม่พบข้อมูลลูกค้ารายนี้", "error");
    return;
  }

  const tbody = document.getElementById("doc-bird-select-tbody");
  tbody.innerHTML = "";

  if (cust.birds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-3 text-center text-sm text-gray-500">ไม่มีนกในทะเบียนของลูกค้ารายนี้</td></tr>`;
  } else {
    cust.birds.forEach(b => {
      let sexHtml = b.sex === "Male" ? "ตัวผู้ ♂" : b.sex === "Female" ? "ตัวเมีย ♀" : "รอผลตรวจ";
      tbody.innerHTML += `
        <tr class="border-b dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
          <td class="px-4 py-2.5 text-center">
            <input type="checkbox" class="doc-bird-checkbox w-4 h-4 text-indigo-600 rounded" value="${b.birdId}">
          </td>
          <td class="px-4 py-2.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">${b.birdId}</td>
          <td class="px-4 py-2.5 font-semibold">${b.breed}</td>
          <td class="px-4 py-2.5 font-mono">${b.ringId || "-"}</td>
          <td class="px-4 py-2.5">${b.sampleType || "ขน"}</td>
          <td class="px-4 py-2.5">${sexHtml}</td>
        </tr>
      `;
    });
  }

  openModal("doc-bird-select-modal");
}

function addSelectedBirdsToDocForm() {
  const ownerId = document.getElementById("doc-form-owner").value;
  const cust = appState.customers.find(c => c.customerId === ownerId);
  if (!cust) return;

  const checkboxes = document.querySelectorAll(".doc-bird-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("กรุณาเลือกนกอย่างน้อย 1 รายการ", "warning");
    return;
  }

  checkboxes.forEach(cb => {
    const birdId = cb.value;
    const bird = cust.birds.find(b => b.birdId === birdId);
    if (bird) {
      // Check if already in form to avoid duplicates
      const container = document.getElementById("doc-form-lines-container");
      const existingSelects = container.querySelectorAll("select[name='line-bird-id']");
      let exists = false;
      existingSelects.forEach(sel => {
        if (sel.value === birdId) exists = true;
      });

      if (!exists) {
        addDocumentLineRow({
          birdId: bird.birdId,
          breed: bird.breed,
          qty: 1,
          unit: "ตัว",
          price: 500,
          discount: 0
        });
      }
    }
  });

  closeModal("doc-bird-select-modal");
  recalcDocumentTotals();
}

// Start app on DOM Loaded
document.addEventListener("DOMContentLoaded", initApp);

// ----------------------------------------------------
// PDF & Print: Bird Specimen Analysis Summary (A4 Portrait)
// ----------------------------------------------------
function openSelectedBirdsSummary() {
  const checkboxes = document.querySelectorAll(".bird-select-checkbox:checked");
  if (checkboxes.length === 0) {
    showToast("กรุณาเลือกนกตัวอย่างอย่างน้อย 1 รายการเพื่อออกใบสรุปผลตรวจ", "warning");
    return;
  }

  let selectedBirds = [];
  let ownerId = null;
  let ownerObj = null;

  checkboxes.forEach(cb => {
    const bId = cb.getAttribute("data-id");
    appState.customers.forEach(c => {
      const found = c.birds.find(b => b.birdId === bId);
      if (found) {
        if (!ownerId) {
          ownerId = c.customerId;
          ownerObj = c;
        }
        selectedBirds.push({
          ...found,
          ownerName: c.name
        });
      }
    });
  });

  const distinctOwners = [...new Set(selectedBirds.map(b => b.ownerName))];
  if (distinctOwners.length > 1) {
    showToast("กรุณาเลือกเฉพาะนกของเจ้าของรายเดียวกันเพื่อออกใบสรุปผลตรวจ", "error");
    return;
  }

  // Populate Summary Details
  document.getElementById("summary-cust-name").innerText = ownerObj.name;
  document.getElementById("summary-cust-address").innerText = ownerObj.address;
  document.getElementById("summary-cust-phone").innerText = maskSensitiveData(ownerObj.phone, "phone");
  document.getElementById("summary-print-date").innerText = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  // Set Certifier Name
  document.getElementById("summary-sign-name").innerText = appState.activeUser ? appState.activeUser.name : "ผู้ตรวจสอบที่ได้รับอนุมัติ";

  // Render Table Rows
  const tbody = document.getElementById("summary-items-tbody");
  tbody.innerHTML = "";
  selectedBirds.forEach((b, index) => {
    let sexHtml = "";
    if (b.sex === "Male") {
      sexHtml = `<span class="text-blue-600 dark:text-blue-400 font-bold"><i class="fas fa-mars mr-1"></i>ตัวผู้ (♂)</span>`;
    } else if (b.sex === "Female") {
      sexHtml = `<span class="text-pink-600 dark:text-pink-400 font-bold"><i class="fas fa-venus mr-1"></i>ตัวเมีย (♀)</span>`;
    } else {
      sexHtml = `<span class="text-gray-400">รอผลตรวจ</span>`;
    }

    tbody.innerHTML += `
      <tr class="border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
        <td class="px-4 py-3 text-center border border-gray-200 dark:border-gray-700">${index + 1}</td>
        <td class="px-4 py-3 font-bold font-mono text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-gray-700">${b.birdId}</td>
        <td class="px-4 py-3 font-mono border border-gray-200 dark:border-gray-700">${b.ringId || "-"}</td>
        <td class="px-4 py-3 border border-gray-200 dark:border-gray-700">${b.breed}</td>
        <td class="px-4 py-3 border border-gray-200 dark:border-gray-700">${b.sampleType || "ขน"}</td>
        <td class="px-4 py-3 text-center border border-gray-200 dark:border-gray-700">${sexHtml}</td>
      </tr>
    `;
  });

  hideAllViewContainers();
  document.getElementById("summary-preview-view").classList.remove("hidden");
  window.scrollTo(0,0);
}

function printSummaryDocument() {
  const custName = document.getElementById("summary-cust-name").innerText;
  const dateStr = new Date().toISOString().substring(0, 10);
  logDocumentExport(`SUM-${custName}-${dateStr}`, "Certificate Summary", "Print");

  const originalTitle = document.title;
  document.title = `Summary-Report-${custName}`;

  window.print();

  document.title = originalTitle;
}

function downloadSummaryPDF() {
  const custName = document.getElementById("summary-cust-name").innerText;
  const element = document.querySelector("#summary-preview-view .summary-paper");
  if (!element) {
    showToast("ไม่พบหน้าต่างพรีวิวใบสรุปผลตรวจ", "error");
    return;
  }

  const dateStr = new Date().toISOString().substring(0, 10);
  logDocumentExport(`SUM-${custName}-${dateStr}`, "Certificate Summary", "PDF Download");

  const opt = {
    margin:       0.3,
    filename:     `Summary-Report-${custName}-${dateStr}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2.5, useCORS: true, letterRendering: false, backgroundColor: '#ffffff' },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  showToast("กำลังสร้างไฟล์ PDF ใบสรุปผลตรวจ...", "info");

  html2pdf().set(opt).from(element).save()
    .then(() => {
      showToast("ดาวน์โหลดไฟล์ PDF ใบสรุปผลตรวจสำเร็จแล้ว", "success");
    })
    .catch(err => {
      showToast("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: " + err.toString(), "error");
    });
}

