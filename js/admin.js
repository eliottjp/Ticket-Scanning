// Import Supabase
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🔹 Supabase Config
const SUPABASE_URL = "https://apfyjrkekezonmobnxte.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwZnlqcmtla2V6b25tb2JueHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzMTQ0NTIsImV4cCI6MjA1NTg5MDQ1Mn0.zHBBivvtbByG7FDp9Rq0OeZ9wY669WVXmy2r_ZuYTiQ";

// 🔹 Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let eventID = null;
let scanChart = null; // Store Chart.js instance

// 🔹 Fetch Active Event ID from Supabase
async function fetchEventID() {
  try {
    console.log("🔄 Fetching active event ID...");

    let { data, error } = await supabase
      .from("globalsettings") // ✅ Check table name
      .select("eventid") // ✅ Ensure correct column name (use lowercase if necessary)
      .eq("id", "CurrentEvent")
      .single();

    if (error) throw error;

    if (data?.eventid) {
      eventID = data.eventid; // ✅ Match the exact column name
      console.log(`📂 Active Event: ${eventID}`);

      // 🔄 Update UI Data
      updateTicketCounts();
      loadScanChartData();
    } else {
      console.warn("⚠️ No active event found in globalsettings!");
      eventID = null; // ✅ Prevent undefined errors
    }
  } catch (err) {
    console.error("❌ Error fetching event ID:", err.message);
  }
}

// 🔥 Call fetchEventID() on page load
fetchEventID();

// 🔹 Update Ticket Counts (Scanned & Remaining) using Supabase
async function updateTicketCounts() {
  if (!eventID) return;

  try {
    // 🔹 Fetch total ticket count
    let { count: totalTickets, error: totalError } = await supabase
      .from(eventID)
      .select("*", { count: "exact", head: true });

    if (totalError) throw totalError;

    // 🔹 Fetch checked-in ticket count
    let { count: checkedInCount, error: checkedInError } = await supabase
      .from(eventID)
      .select("*", { count: "exact", head: true })
      .eq("checkedIn", true);

    if (checkedInError) throw checkedInError;

    let remainingCount = totalTickets - checkedInCount;

    // 🔹 Update UI
    document.getElementById("scannedCount").innerText = checkedInCount;
    document.getElementById("remainingCount").innerText = remainingCount;
  } catch (err) {
    console.error("❌ Error updating ticket counts:", err);
  }
}

// 🔹 Load Scan Data (5-Minute Intervals) from Supabase
async function loadScanChartData() {
  if (!eventID) return;

  // 📊 Define 5-minute intervals from 6:30 PM - 7:30 PM
  let timeSlots = [];
  for (let i = 30; i <= 60; i += 5) {
    let label = i === 60 ? "7:30 PM" : `6:${i} PM`;
    timeSlots.push({ label, count: 0 });
  }

  try {
    // 🔹 Fetch checked-in tickets from Supabase
    let { data, error } = await supabase
      .from(eventID)
      .select("timestamp")
      .eq("checkedIn", true)
      .not("timestamp", "is", null);

    if (error) throw error;

    // 🔹 Process timestamps
    data.forEach((ticket) => {
      let date = new Date(ticket.timestamp); // ✅ Supabase stores timestamps in ISO format

      let hour = date.getHours();
      let minutes = date.getMinutes();

      if (hour === 18 && minutes >= 30) {
        let index = Math.floor((minutes - 30) / 5);
        timeSlots[index].count++;
      } else if (hour === 19 && minutes < 30) {
        let index = Math.floor(minutes / 5) + 6;
        timeSlots[index].count++;
      }
    });

    // 🔹 Render chart with updated data
    renderScanChart(timeSlots);
  } catch (err) {
    console.error("❌ Error loading scan data:", err);
  }
}

// 🔹 Render 5-Minute Interval Bar Chart
function renderScanChart(timeSlots) {
  let ctx = document.getElementById("scanChart").getContext("2d");

  // Destroy previous chart instance if it exists
  if (scanChart) {
    scanChart.destroy();
  }

  scanChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: timeSlots.map((slot) => slot.label),
      datasets: [
        {
          label: "Scans per 5 min",
          data: timeSlots.map((slot) => slot.count),
          backgroundColor: "rgba(106, 13, 173, 0.6)",
          borderColor: "rgba(106, 13, 173, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

document.getElementById("resetButton").addEventListener("click", async () => {
  if (!eventID) {
    alert("⚠️ No event found.");
    return;
  }

  let confirmation = confirm(
    "⚠️ Are you sure you want to reset all scanned tickets?"
  );
  if (!confirmation) return;

  try {
    // 🔹 Reset all checked-in tickets for the current event
    let { error } = await supabase
      .from(eventID) // The table name is the eventID
      .update({ checkedIn: false, timestamp: null }) // Reset values
      .eq("checkedIn", true); // Only update scanned tickets

    if (error) throw error;

    alert("✅ All scanned tickets have been reset.");
    updateTicketCounts();
    loadScanChartData();
  } catch (error) {
    console.error("❌ Error resetting tickets:", error);
    alert("❌ Error resetting tickets.");
  }
});

// 🔹 CSV File Upload & Store in Supabase
document
  .getElementById("uploadBtn")
  .addEventListener("click", async function () {
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
        console.error("⚠️ CSV file is missing required columns.");
        alert("❌ CSV file format incorrect. Please check the template.");
        return;
      }

      // 🔹 Create a unique and valid event ID
      let eventID = `${eventName.replace(/\s+/g, "_")}_${eventDate}`;
      console.log(`📂 Event ID: ${eventID}`);

      // 🔹 Ensure eventID is a valid table name
      eventID = eventID.replace(/[^a-zA-Z0-9_]/g, ""); // Remove invalid characters

      // 🔹 Store event ID in Supabase (globalsettings table)
      let { error: globalError } = await supabase
        .from("globalsettings")
        .upsert([{ id: "CurrentEvent", eventid: eventID }]); // ✅ Use correct column name

      if (globalError) {
        console.error("❌ Error saving event ID:", globalError);
        alert("❌ Error saving event ID.");
        return;
      }

      // 🔹 Skip the first 3 rows of headers
      rows.splice(0, 3);
      console.log(`🔍 Total rows after removing headers: ${rows.length}`);

      let batchSize = 500;
      let batchPromises = [];
      let uniqueIDs = new Set();
      let ticketBatch = [];
      let totalUploaded = 0;

      // 🔹 Process CSV Rows
      for (let row of rows) {
        if (row.length < 12) {
          console.warn(
            `⚠️ Skipped row due to insufficient columns (${row.length}):`,
            row
          );
          continue;
        }

        let ticketID = row[0]?.replace(/['"]/g, "").trim();
        let name = row[3]?.replace(/['"]/g, "").trim() || "Unknown";
        let barcode = row[2]?.replace(/['"]/g, "").trim() || "";
        let confirmation = row[8]?.replace(/['"]/g, "").trim() || "";
        let rowNumber = row[10]?.replace(/['"]/g, "").trim() || "";
        let seatNumber = row[11]?.replace(/['"]/g, "").trim() || "";
        let isVIP = row[5]?.toLowerCase().includes("vip") ? "Yes" : "No";

        if (!ticketID) {
          console.warn("⚠️ Skipped row due to missing ticket ID:", row);
          continue;
        }

        if (uniqueIDs.has(ticketID)) {
          console.warn(`⚠️ Duplicate Ticket ID found: ${ticketID}, skipping.`);
          continue;
        } else {
          uniqueIDs.add(ticketID);
        }

        let ticketData = {
          id: ticketID,
          eventid: eventID, // ✅ Use lowercase column name
          name,
          barcode,
          confirmation,
          rowNumber,
          seatNumber,
          vipGuest: isVIP,
          checkedIn: false,
          timestamp: null,
        };

        ticketBatch.push(ticketData);
        totalUploaded++;

        // 🔹 Upload in batches
        if (ticketBatch.length >= batchSize) {
          batchPromises.push(supabase.from(eventID).insert(ticketBatch));
          ticketBatch = [];
        }
      }

      // 🔹 Upload remaining tickets
      if (ticketBatch.length > 0) {
        batchPromises.push(supabase.from(eventID).insert(ticketBatch));
      }

      // 🔹 Upload all batches
      try {
        await Promise.all(batchPromises);
        alert("✅ Upload successful!");
        fetchEventID();
        console.log(`✅ Successfully uploaded ${totalUploaded} tickets.`);
      } catch (error) {
        console.error("❌ Error uploading file:", error);
        alert("❌ Error uploading file.");
      }
    };

    reader.readAsText(file);
  });
