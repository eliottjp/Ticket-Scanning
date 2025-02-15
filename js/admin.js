import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
