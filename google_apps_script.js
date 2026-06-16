/**
 * The Nest Application - Google Apps Script Backend
 * 
 * Instructions:
 * 1. Open Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any code in the editor and paste this code.
 * 4. Create three sheets (Tabs) inside your Google Sheet named:
 *    - "USER" (Columns: UserID, Password, Tier, Name, CreatedAt)
 *    - "CUSTOMER" (Columns: CustomerID, Name, Address, IDCard, Phone, Email, Type, Notes, BirdsJSON, CreatedAt)
 *    - "Receipts&Quotations" (Columns: DocumentID, Type, Date, CustomerID, ItemsJSON, Discount, Total, LinkedQuotationID, Status, CreatedAt)
 * 5. Click "Deploy" > "New deployment".
 * 6. Select "Web app" as the type.
 * 7. Set "Execute as" to "Me" and "Who has access" to "Anyone".
 * 8. Copy the Web App URL and paste it in the Settings of The Nest Application UI.
 */

// Handle POST requests from the client (JSON communication)
function doPost(e) {
  var response = { success: false, message: "Invalid Request" };
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var data = requestData.data;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Ensure all required sheets exist
    checkAndSetupSheets(ss);

    if (action === "login") {
      response = handleLogin(ss, data);
    } else if (action === "registerUser") {
      response = handleRegisterUser(ss, data);
    } else if (action === "updateUserTier") {
      response = handleUpdateUserTier(ss, data);
    } else if (action === "syncCustomers") {
      response = handleSyncCustomers(ss, data);
    } else if (action === "syncReceipts") {
      response = handleSyncReceipts(ss, data);
    } else if (action === "fetchData") {
      response = handleFetchData(ss);
    } else {
      response.message = "Unknown Action: " + action;
    }
  } catch (error) {
    response.message = "Server Error: " + error.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
}

// Handle OPTIONS preflight requests for CORS
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
}

// Check and initialize tabs if missing
function checkAndSetupSheets(ss) {
  var userSheet = ss.getSheetByName("USER");
  if (!userSheet) {
    userSheet = ss.insertSheet("USER");
    userSheet.appendRow(["UserID", "Password", "Tier", "Name", "CreatedAt"]);
    // Insert default super admin
    userSheet.appendRow(["hrdnci", "123456", "Super admin", "Super Admin (HRD)", new Date().toISOString()]);
  }

  var customerSheet = ss.getSheetByName("CUSTOMER");
  if (!customerSheet) {
    customerSheet = ss.insertSheet("CUSTOMER");
    customerSheet.appendRow(["CustomerID", "Name", "Address", "IDCard", "Phone", "Email", "Type", "Notes", "BirdsJSON", "CreatedAt"]);
  }

  var reqSheet = ss.getSheetByName("Receipts&Quotations");
  if (!reqSheet) {
    reqSheet = ss.insertSheet("Receipts&Quotations");
    reqSheet.appendRow(["DocumentID", "Type", "Date", "CustomerID", "ItemsJSON", "Discount", "Total", "LinkedQuotationID", "Status", "CreatedAt"]);
  }
}

// Login verification
function handleLogin(ss, data) {
  var sheet = ss.getSheetByName("USER");
  var rows = sheet.getDataRange().getValues();
  var userId = data.userId.toLowerCase().trim();
  var password = data.password;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === userId && rows[i][1].toString() === password) {
      return {
        success: true,
        user: {
          userId: rows[i][0],
          name: rows[i][3],
          tier: rows[i][2]
        }
      };
    }
  }
  return { success: false, message: "รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
}

// User registration (Admin list management)
function handleRegisterUser(ss, data) {
  var sheet = ss.getSheetByName("USER");
  var rows = sheet.getDataRange().getValues();
  var userId = data.userId.toLowerCase().trim();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === userId) {
      return { success: false, message: "มีบัญชีผู้ใช้งานนี้ในระบบแล้ว" };
    }
  }

  sheet.appendRow([
    userId,
    data.password,
    data.tier || "Common",
    data.name || userId,
    new Date().toISOString()
  ]);

  return { success: true, message: "สมัครสมาชิกแอดมินสำเร็จ" };
}

// User tier promotion / demotion
function handleUpdateUserTier(ss, data) {
  var sheet = ss.getSheetByName("USER");
  var range = sheet.getDataRange();
  var rows = range.getValues();
  var userId = data.userId.toLowerCase().trim();
  var newTier = data.tier;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === userId) {
      sheet.getCell(i + 1, 3).setValue(newTier);
      return { success: true, message: "อัปเดตระดับสิทธิ์สำเร็จ" };
    }
  }
  return { success: false, message: "ไม่พบผู้ใช้ที่ระบุ" };
}

// Sync all customer & birds data from client (Full overwrite to keep in sync)
function handleSyncCustomers(ss, data) {
  var sheet = ss.getSheetByName("CUSTOMER");
  sheet.clearContents();
  sheet.appendRow(["CustomerID", "Name", "Address", "IDCard", "Phone", "Email", "Type", "Notes", "BirdsJSON", "CreatedAt"]);
  
  if (data && data.length > 0) {
    for (var i = 0; i < data.length; i++) {
      var c = data[i];
      sheet.appendRow([
        c.customerId,
        c.name,
        c.address,
        c.idCard,
        c.phone,
        c.email,
        c.type,
        c.notes,
        JSON.stringify(c.birds || []),
        c.createdAt || new Date().toISOString()
      ]);
    }
  }
  return { success: true, message: "ซิงค์ข้อมูลลูกค้าและตัวอย่างสำเร็จ" };
}

// Sync all receipts & quotations data
function handleSyncReceipts(ss, data) {
  var sheet = ss.getSheetByName("Receipts&Quotations");
  sheet.clearContents();
  sheet.appendRow(["DocumentID", "Type", "Date", "CustomerID", "ItemsJSON", "Discount", "Total", "LinkedQuotationID", "Status", "CreatedAt"]);

  if (data && data.length > 0) {
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      sheet.appendRow([
        r.documentId,
        r.type,
        r.date,
        r.customerId,
        JSON.stringify(r.items || []),
        r.discount || 0,
        r.total || 0,
        r.linkedQuotationId || "",
        r.status || "Paid",
        r.createdAt || new Date().toISOString()
      ]);
    }
  }
  return { success: true, message: "ซิงค์ข้อมูลการเงินและใบเสร็จสำเร็จ" };
}

// Fetch all database tables for initial load
function handleFetchData(ss) {
  var data = {
    users: [],
    customers: [],
    receipts: []
  };

  // 1. Fetch Users
  var userSheet = ss.getSheetByName("USER");
  if (userSheet) {
    var userRows = userSheet.getDataRange().getValues();
    for (var i = 1; i < userRows.length; i++) {
      data.users.push({
        userId: userRows[i][0],
        // Do not return password to common queries, but return for verification/local edit if superadmin
        tier: userRows[i][2],
        name: userRows[i][3],
        createdAt: userRows[i][4]
      });
    }
  }

  // 2. Fetch Customers and Birds
  var customerSheet = ss.getSheetByName("CUSTOMER");
  if (customerSheet) {
    var customerRows = customerSheet.getDataRange().getValues();
    for (var i = 1; i < customerRows.length; i++) {
      var birds = [];
      try {
        birds = JSON.parse(customerRows[i][8]);
      } catch(e) {}
      
      data.customers.push({
        customerId: customerRows[i][0],
        name: customerRows[i][1],
        address: customerRows[i][2],
        idCard: customerRows[i][3],
        phone: customerRows[i][4],
        email: customerRows[i][5],
        type: customerRows[i][6],
        notes: customerRows[i][7],
        birds: birds,
        createdAt: customerRows[i][9]
      });
    }
  }

  // 3. Fetch Receipts & Quotations
  var reqSheet = ss.getSheetByName("Receipts&Quotations");
  if (reqSheet) {
    var reqRows = reqSheet.getDataRange().getValues();
    for (var i = 1; i < reqRows.length; i++) {
      var items = [];
      try {
        items = JSON.parse(reqRows[i][4]);
      } catch(e) {}

      data.receipts.push({
        documentId: reqRows[i][0],
        type: reqRows[i][1],
        date: reqRows[i][2],
        customerId: reqRows[i][3],
        items: items,
        discount: parseFloat(reqRows[i][5]) || 0,
        total: parseFloat(reqRows[i][6]) || 0,
        linkedQuotationId: reqRows[i][7],
        status: reqRows[i][8],
        createdAt: reqRows[i][9]
      });
    }
  }

  return { success: true, data: data };
}
