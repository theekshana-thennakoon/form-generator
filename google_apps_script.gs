/**
 * Dynamic Form Builder - Google Apps Script Backend
 * 
 * Instructions:
 * 1. Create a Master Spreadsheet.
 * 2. Create a sheet (tab) named EXACTLY "Templates".
 * 3. In the "Templates" sheet, put these exact headers in Row 1:
 *    A1: Template ID
 *    B1: Form Name
 *    C1: Spreadsheet URL
 *    D1: JSON Schema
 *    E1: Theme JSON
 *    F1: Description
 * 4. Deploy as a Web App (Execute as Me, Access: Anyone).
 */

const MASTER_SPREADSHEET_ID = '1BewneqtRYtS_goG8OPCWBwnL5KYaFKJ5aQzEUKHFb3A';
const TEMPLATES_SHEET_NAME = 'Templates';

function doPost(e) {
  try {
    const masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    const templatesSheet = masterSS.getSheetByName(TEMPLATES_SHEET_NAME);
    
    let payload;
    if (e.postData.type === "application/json") {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action;

    // --- CREATE TEMPLATE (Admin Builder) ---
    if (action === 'create_template') {
      const formName = payload.formName;
      const description = payload.description || '';
      const schema = payload.schema; // Array of question objects
      const theme = payload.theme || {};
      
      const templateId = 'FORM-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      
      // 1. Create a brand new Google Spreadsheet for this form's answers
      const newSS = SpreadsheetApp.create(formName + " Responses");
      const targetSheet = newSS.getActiveSheet();
      
      // 2. Setup headers in the new spreadsheet
      const headers = ['Timestamp', 'Submission ID'];
      schema.forEach(q => headers.push(q.label)); // Add a column for every question
      
      const numCols = headers.length;
      
      // Format Row 1: Form Name Title
      targetSheet.getRange(1, 1).setValue(formName);
      const titleRange = targetSheet.getRange(1, 1, 1, numCols);
      titleRange.merge();
      titleRange.setBackground("#2b2d42");
      titleRange.setFontColor("#ffffff");
      titleRange.setFontSize(16);
      titleRange.setFontWeight("bold");
      titleRange.setHorizontalAlignment("center");
      titleRange.setVerticalAlignment("middle");
      targetSheet.setRowHeight(1, 50);
      
      // Format Row 2: Form Description
      targetSheet.getRange(2, 1).setValue(description);
      const descRange = targetSheet.getRange(2, 1, 1, numCols);
      descRange.merge();
      descRange.setBackground("#f8f9fa");
      descRange.setFontColor("#6c757d");
      descRange.setFontStyle("italic");
      descRange.setHorizontalAlignment("center");
      descRange.setVerticalAlignment("middle");
      targetSheet.setRowHeight(2, 30);
      
      // Format Row 3: Headers
      targetSheet.getRange(3, 1, 1, numCols).setValues([headers]);
      const headerRange = targetSheet.getRange(3, 1, 1, numCols);
      headerRange.setBackground(theme.primary || "#4361ee");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      
      targetSheet.setFrozenRows(3);
      
      // Auto-resize and Banding (Zebra striping)
      targetSheet.autoResizeColumns(1, numCols);
      const fullRange = targetSheet.getRange(3, 1, 1000, numCols);
      fullRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
      
      const newSsUrl = newSS.getUrl();
      
      // 3. Save the template record in the Master Spreadsheet
      templatesSheet.appendRow([
        templateId,
        formName,
        newSsUrl,
        JSON.stringify(schema),
        JSON.stringify(theme),
        description
      ]);
      
      return successResponse({ id: templateId, message: "Form Template created successfully." });
    }
    
    // --- GET ALL TEMPLATES (Admin Panel List) ---
    else if (action === 'get_templates') {
      const data = templatesSheet.getDataRange().getValues();
      if (data.length <= 1) return successResponse([]);
      
      const rows = data.slice(1);
      const result = rows.map(row => {
        return {
          id: row[0],
          formName: row[1],
          sheetUrl: row[2],
          schema: row[3],
          theme: row[4] ? JSON.parse(row[4]) : {},
          description: row[5] || ""
        };
      });
      
      return successResponse(result);
    }

    // --- GET SINGLE TEMPLATE SCHEMA (Form Renderer) ---
    else if (action === 'get_template') {
      const targetId = payload.id;
      const data = templatesSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === targetId) {
          return successResponse({
            id: data[i][0],
            formName: data[i][1],
            schema: JSON.parse(data[i][3]),
            theme: data[i][4] ? JSON.parse(data[i][4]) : {},
            description: data[i][5] || ""
          });
        }
      }
      return errorResponse("Template not found.");
    }
    // --- UPDATE TEMPLATE ---
    else if (action === 'update_template') {
      const targetId = payload.id;
      const formName = payload.formName;
      const description = payload.description || "";
      const schema = payload.schema;
      const theme = payload.theme || {};
      const data = templatesSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === targetId) {
          // Update the Master Sheet row
          templatesSheet.getRange(i + 1, 2).setValue(formName);
          templatesSheet.getRange(i + 1, 4).setValue(JSON.stringify(schema));
          templatesSheet.getRange(i + 1, 5).setValue(JSON.stringify(theme));
          templatesSheet.getRange(i + 1, 6).setValue(description);
          
          // Update the Target Spreadsheet Headers
          const targetUrl = data[i][2];
          const targetSS = SpreadsheetApp.openByUrl(targetUrl);
          const targetSheet = targetSS.getActiveSheet();
          
          // Clear row 3 and rewrite headers
          targetSheet.getRange("3:3").clearContent();
          
          const headers = ['Timestamp', 'Submission ID'];
          schema.forEach(q => headers.push(q.label));
          const numCols = headers.length;
          
          const headerRange = targetSheet.getRange(3, 1, 1, numCols);
          headerRange.setValues([headers]);
          headerRange.setBackground(theme.primary || "#4361ee");
          headerRange.setFontColor("#ffffff");
          headerRange.setFontWeight("bold");
          headerRange.setHorizontalAlignment("center");
          
          // Update Title and Description
          const titleRange = targetSheet.getRange(1, 1, 1, numCols);
          titleRange.merge();
          targetSheet.getRange(1, 1).setValue(formName);
          
          const descRange = targetSheet.getRange(2, 1, 1, numCols);
          descRange.merge();
          targetSheet.getRange(2, 1).setValue(description);
          
          // Re-apply auto resize
          targetSheet.autoResizeColumns(1, numCols);
          
          return successResponse({ message: "Template updated successfully." });
        }
      }
      return errorResponse("Template not found.");
    }

    // --- DELETE TEMPLATE ---
    else if (action === 'delete_template') {
      const targetId = payload.id;
      const data = templatesSheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === targetId) {
          templatesSheet.deleteRow(i + 1);
          return successResponse({ message: "Template deleted successfully." });
        }
      }
      return errorResponse("Template not found.");
    }
    // --- SUBMIT DYNAMIC FORM ANSWERS ---
    else if (action === 'submit_dynamic') {
      const targetId = payload.id;
      const answers = payload.answers; // Object matching { label: value }
      
      // 1. Find the target Spreadsheet URL from the master sheet
      const data = templatesSheet.getDataRange().getValues();
      let targetUrl = null;
      let schema = null;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === targetId) {
          targetUrl = data[i][2];
          schema = JSON.parse(data[i][3]);
          break;
        }
      }
      
      if (!targetUrl) return errorResponse("Form Template not found.");
      
      // 2. Open the specific target spreadsheet
      const targetSS = SpreadsheetApp.openByUrl(targetUrl);
      const sheet = targetSS.getActiveSheet();
      const headers = sheet.getDataRange().getValues()[2]; // Read from row 3 (index 2)
      
      // 3. Map answers to correct column order
      const rowToAppend = [];
      const subId = 'SUB-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      
      headers.forEach(header => {
        if (header === 'Timestamp') {
          rowToAppend.push(new Date());
        } else if (header === 'Submission ID') {
          rowToAppend.push(subId);
        } else {
          // Find answer for this header
          rowToAppend.push(answers[header] !== undefined ? answers[header] : '');
        }
      });
      
      sheet.appendRow(rowToAppend);
      
      return successResponse({ id: subId, message: "Response submitted successfully." });
    }

    // --- GET FORM SUBMISSIONS ---
    else if (action === 'get_submissions') {
      const targetId = payload.id;
      
      const data = templatesSheet.getDataRange().getValues();
      let targetUrl = null;
      let formName = null;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === targetId) {
          formName = data[i][1];
          targetUrl = data[i][2];
          break;
        }
      }
      
      if (!targetUrl) return errorResponse("Form Template not found.");
      
      const targetSS = SpreadsheetApp.openByUrl(targetUrl);
      const sheet = targetSS.getActiveSheet();
      
      // Get all data
      const sheetData = sheet.getDataRange().getValues();
      
      // If there are no data rows (only Title, Desc, Headers)
      if (sheetData.length <= 3) {
        return successResponse({ formName: formName, headers: [], rows: [] });
      }
      
      const headers = sheetData[2]; // Row 3 is index 2
      const rows = sheetData.slice(3); // Data starts at Row 4 (index 3)
      
      // Format timestamps for JSON serialization
      const formattedRows = rows.map(row => {
        return row.map(cell => {
          if (cell instanceof Date) {
            return cell.toISOString();
          }
          return cell;
        });
      });
      
      return successResponse({ 
        formName: formName,
        headers: headers, 
        rows: formattedRows 
      });
    }

    else {
      return errorResponse("Invalid action parameter.");
    }

  } catch (error) {
    return errorResponse(error.toString());
  }
}

function successResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "success", data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "error", message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService
    .createTextOutput("Dynamic Form API is running. Use POST.")
    .setMimeType(ContentService.MimeType.TEXT);
}
