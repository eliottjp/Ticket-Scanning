// Import Supabase
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🔹 Supabase Config
const SUPABASE_URL = "https://apfyjrkekezonmobnxte.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZnlqcmtla2V6b25tb2JueHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzMTQ0NTIsImV4cCI6MjA1NTg5MDQ1Mn0.zHBBivvtbByG7FDp9Rq0OeZ9wY669WVXmy2r_ZuYTiQ";

// 🔹 Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let eventID = null;

// 🔹 Fetch Active Event ID from Supabase
async function fetchEventID() {
  try {
    console.log("🔄 Fetching active event ID...");

    let { data, error } = await supabase
      .from("globalsettings")
      .select("eventid")
      .eq("id", "CurrentEvent")
      .single();

    if (error) throw error;

    eventID = data?.eventid || null;
    console.log(`📂 Active Event: ${eventID}`);

    if (eventID) {
      updateTicketCounts();
    } else {
      console.warn("⚠️ No active event found!");
    }
  } catch (err) {
    console.error("❌ Error fetching event ID:", err.message);
  }
}

fetchEventID();
// 🔹 Create Event Table (Ensured)
async function createEventTable(eventID) {
  console.log(`📌 Checking/Creating table for event: ${eventID}`);

  let { data, error } = await supabase.rpc("create_event_table", {
    event_name: eventID, // Ensure this matches your function's expected input
  });

  if (error) {
    console.error("❌ Error creating table:", error.message);
    return false; // Return false if table creation failed
  } else {
    console.log(`✅ Table "${eventID}" is ready.`);
    return true; // Return true if successful
  }
}

// 🔹 CSV Upload (Ensured)
async function uploadCSV() {
  const fileInput = document.getElementById("fileInput");
  const eventName = document.getElementById("eventName").value.trim();
  const eventDate = document.getElementById("eventDate").value.trim();

  if (!fileInput.files.length || !eventName || !eventDate) {
    alert("❌ Please select a file and enter event details.");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function (e) {
    const csvData = e.target.result;
    let rows = csvData
      .split("\n")
      .map((row) => row.split(",").map((cell) => cell.trim()));

    if (rows.length < 4) {
      alert("❌ Incorrect CSV format.");
      return;
    }

    let eventID = `${eventName.replace(/\s+/g, "_")}_${eventDate}`.replace(
      /[^a-zA-Z0-9_]/g,
      ""
    );
    console.log(`📂 Event ID: ${eventID}`);

    // 🔹 Save event ID to global settings
    let { error: globalError } = await supabase
      .from("globalsettings")
      .upsert([{ id: "CurrentEvent", eventid: eventID }]);
    if (globalError) {
      alert("❌ Error saving event ID.");
      return;
    }

    // 🔹 Create event table if it does not exist
    const tableCreated = await createEventTable(eventID);
    if (!tableCreated) {
      alert(`❌ Table creation failed for ${eventID}. Check logs.`);
      return;
    }

    // 🔹 Remove headers
    rows.splice(0, 3);
    console.log(`🔍 Processing ${rows.length} rows.`);

    let batchSize = 500;
    let batchPromises = [];
    let uniqueIDs = new Set();
    let ticketBatch = [];
    let totalUploaded = 0;

    for (let row of rows) {
      if (row.length < 12) continue;

      let ticketID = row[0]?.replace(/['"]/g, "").trim();
      if (!ticketID || uniqueIDs.has(ticketID)) continue;

      uniqueIDs.add(ticketID);

      ticketBatch.push({
        id: ticketID,
        eventid: eventID,
        name: row[3]?.replace(/['"]/g, "").trim() || "Unknown",
        barcode: row[2]?.replace(/['"]/g, "").trim() || "",
        confirmation: row[8]?.replace(/['"]/g, "").trim() || "",
        rowNumber: row[10]?.replace(/['"]/g, "").trim() || "",
        seatNumber: row[11]?.replace(/['"]/g, "").trim() || "",
        vipGuest: row[5]?.toLowerCase().includes("vip") ? "Yes" : "No",
        checkedIn: false,
        timestamp: null,
      });

      totalUploaded++;

      if (ticketBatch.length >= batchSize) {
        batchPromises.push(supabase.from(eventID).insert(ticketBatch));
        ticketBatch = [];
      }
    }

    if (ticketBatch.length > 0) {
      batchPromises.push(supabase.from(eventID).insert(ticketBatch));
    }

    try {
      await Promise.all(batchPromises);
      alert("✅ Upload successful!");
      fetchEventID();
      console.log(`✅ Uploaded ${totalUploaded} tickets.`);
    } catch (error) {
      console.error("❌ Upload error:", error);
      alert("❌ Upload failed.");
    }
  };

  reader.readAsText(file);
}
