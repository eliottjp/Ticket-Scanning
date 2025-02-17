import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  query,
  where,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";
import { writeBatch } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// 🔹 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCd5lYY7EAkxYzV_lbolu7KFx8nTEHiLug",
  authDomain: "ticket-scanner-2b7f1.firebaseapp.com",
  projectId: "ticket-scanner-2b7f1",
  storageBucket: "ticket-scanner-2b7f1.appspot.com",
  messagingSenderId: "431290258037",
  appId: "1:431290258037:web:73fa6d44e5335c37989e3c",
};

// 🔹 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let eventID = null;
let scanChart = null; // Store Chart.js instance

// 🔹 Fetch Active Event ID
async function fetchEventID() {
  const globalRef = doc(db, "GlobalSettings", "CurrentEvent");
  const docSnap = await getDoc(globalRef);
  if (docSnap.exists()) {
    eventID = docSnap.data().eventID;
    console.log(`📂 Active Event: ${eventID}`);
    updateTicketCounts();
    loadScanChartData(); // 📊 Load 5-minute interval chart
  } else {
    console.log("⚠️ No event found!");
  }
}

fetchEventID();

// 🔹 Update Ticket Counts (Scanned & Remaining)
async function updateTicketCounts() {
  if (!eventID) return;

  let ticketsRef = collection(db, eventID);
  let totalTickets = (await getDocs(ticketsRef)).size;
  let checkedInCount = (
    await getDocs(query(ticketsRef, where("checkedIn", "==", true)))
  ).size;
  let remainingCount = totalTickets - checkedInCount;

  document.getElementById("scannedCount").innerText = checkedInCount;
  document.getElementById("remainingCount").innerText = remainingCount;
}

// 🔹 Load Scan Data (5-Minute Intervals)
async function loadScanChartData() {
  if (!eventID) return;

  // 📊 Define 5-minute intervals from 6:30 PM - 7:30 PM
  let timeSlots = [];
  for (let i = 30; i <= 60; i += 5) {
    let label = i === 60 ? "7:30 PM" : `6:${i} PM`;
    timeSlots.push({ label, count: 0 });
  }

  let ticketsRef = collection(db, eventID);
  let querySnapshot = await getDocs(
    query(ticketsRef, where("checkedIn", "==", true))
  );

  querySnapshot.forEach((docSnap) => {
    let data = docSnap.data();
    if (data.timestamp && data.timestamp.seconds) {
      let date = new Date(data.timestamp.seconds * 1000); // ✅ Convert Firestore timestamp to JS Date
      let hour = date.getHours();
      let minutes = date.getMinutes();

      if (hour === 18 && minutes >= 30) {
        let index = Math.floor((minutes - 30) / 5);
        timeSlots[index].count++;
      } else if (hour === 19 && minutes < 30) {
        let index = Math.floor(minutes / 5) + 6;
        timeSlots[index].count++;
      }
    }
  });

  renderScanChart(timeSlots);
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

// 🔹 Reset Scanned Tickets
document.getElementById("resetButton").addEventListener("click", async () => {
  if (!eventID) {
    alert("⚠️ No event found.");
    return;
  }

  let confirmation = confirm(
    "⚠️ Are you sure you want to reset all scanned tickets?"
  );
  if (!confirmation) return;

  let ticketsRef = collection(db, eventID);
  let querySnapshot = await getDocs(
    query(ticketsRef, where("checkedIn", "==", true))
  );

  querySnapshot.forEach(async (docSnap) => {
    let ticketRef = doc(db, eventID, docSnap.id);
    await updateDoc(ticketRef, {
      checkedIn: false,
      timestamp: null, // 🔥 Remove timestamp to reset scan time
    });
  });

  alert("✅ All scanned tickets have been reset.");
  updateTicketCounts();
  loadScanChartData();
});

// 🔹 CSV File Upload & Store in Firestore
// 🔹 CSV File Upload & Store in Firestore
document
  .getElementById("uploadBtn")
  .addEventListener("click", async function () {
    const fileInput = document.getElementById("fileInput");
    const eventName = document.getElementById("eventName").value.trim();
    const eventDate = document.getElementById("eventDate").value.trim();

    if (!fileInput.files.length || !eventName || !eventDate) {
      alert("Please select a file and enter event details.");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
      const csvData = e.target.result;
      let rows = csvData.split("\n").map((row) => row.split(","));

      if (rows.length < 4) {
        console.error("⚠️ CSV file is missing required columns.");
        return;
      }

      // 🔹 Create a unique event ID
      let eventID = `${eventName.replace(/\s+/g, "_")}_${eventDate}`;
      console.log(`📂 Event ID: ${eventID}`);

      // 🔹 Store event ID globally in Firestore
      const globalRef = doc(db, "GlobalSettings", "CurrentEvent");
      await setDoc(globalRef, { eventID }).catch((error) =>
        console.error("❌ Error saving event ID:", error)
      );

      // 🔹 Skip the first 3 rows of headers
      rows.splice(0, 3);
      console.log(`🔍 Total rows after removing headers: ${rows.length}`);

      let batchSize = 500; // Firestore batch limit
      let batchPromises = [];
      let uniqueIDs = new Set();
      let totalUploaded = 0;

      // 🔹 Process CSV Rows
      let batch = writeBatch(db);
      let i = 0;

      for (let row of rows) {
        console.log("🔍 Row Data:", row);
        console.log("🔢 Row Length:", row.length);

        if (row.length < 12) {
          console.warn(
            `⚠️ Skipped row due to insufficient columns (${row.length}):`,
            row
          );
          continue;
        }

        let ticketID = row[0]?.replace(/['"]/g, "").trim(); // 🔹 Use ID from the 1st column
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
          name,
          barcode,
          confirmation,
          rowNumber,
          seatNumber,
          vipGuest: isVIP,
          checkedIn: false,
        };

        console.log("✅ Added ticket:", ticketData);
        let ticketRef = doc(collection(db, eventID), ticketID);
        batch.set(ticketRef, ticketData);
        totalUploaded++;

        // 🔹 Commit batch if limit is reached
        if (++i % batchSize === 0) {
          batchPromises.push(batch.commit());
          batch = writeBatch(db);
        }
      }

      // 🔹 Upload remaining batch
      if (i % batchSize !== 0) {
        batchPromises.push(batch.commit());
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
