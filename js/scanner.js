import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

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

// 🎵 Load Sound Effects
const soundSuccess = new Audio("sounds/success.mp3");
const soundError = new Audio("sounds/error.mp3");
const soundVIP = new Audio("sounds/vip.mp3");

let eventID = null;
let debounceTimeout;

// 🔹 Fetch latest eventID from Firestore
async function fetchEventID() {
  const globalRef = doc(db, "GlobalSettings", "CurrentEvent");
  const docSnap = await getDoc(globalRef);
  if (docSnap.exists()) {
    eventID = docSnap.data().eventID;
    console.log(`📂 Active Event: ${eventID}`);

    const eventElement = document.getElementById("currentEvent");
    if (eventElement) {
      eventElement.innerText = `📅 Event: ${eventID.replace(/_/g, " ")}`;
    }

    listenForTicketUpdates();
    updateTicketCounts();
  } else {
    console.log("⚠️ No event found!");
    const eventElement = document.getElementById("currentEvent");
    if (eventElement) {
      eventElement.innerText = "⚠️ No event uploaded.";
    }
  }
}

// 🔄 Auto-update scanner when a new event is uploaded
onSnapshot(doc(db, "GlobalSettings", "CurrentEvent"), async () => {
  console.log("🔄 Event Updated!");
  await fetchEventID();
});

fetchEventID();

// 🔹 Ticket Scanning Logic
document
  .getElementById("barcodeInput")
  .addEventListener("input", async function (event) {
    let barcode = event.target.value.trim().toLowerCase();
    if (!barcode) return;

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      if (!eventID) {
        showFeedback(
          "⚠️ No Event Found. Upload first.",
          "red",
          soundError,
          "scan-history-invalid"
        );
        return;
      }

      try {
        let ticketsRef = collection(db, eventID);
        let q = query(ticketsRef, where("barcode", "==", barcode));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          showFeedback(
            "❌ Ticket Not Found!",
            "red",
            soundError,
            "scan-history-invalid"
          );
          clearTicketDetails();
        } else {
          querySnapshot.forEach(async (docSnap) => {
            let ticketData = docSnap.data();
            let ticketRef = doc(db, eventID, docSnap.id);

            document.getElementById(
              "ticketName"
            ).innerText = `Name: ${ticketData.name}`;
            document.getElementById(
              "ticketSeat"
            ).innerText = `Seat Number: ${ticketData.seatNumber}`;
            document.getElementById(
              "ticketRow"
            ).innerText = `Row: ${ticketData.rowNumber}`;
            document.getElementById("ticketVIP").innerText = `VIP: ${
              ticketData.vipGuest === "Yes" ? "✅ Yes" : "❌ No"
            }`;

            if (ticketData.checkedIn) {
              showFeedback(
                "⚠️ Ticket already checked in!",
                "red",
                soundError,
                "scan-history-invalid"
              );
            } else {
              await updateDoc(ticketRef, { checkedIn: true });

              let message = `✅ ${ticketData.name}`;
              let color = "green";
              let sound = soundSuccess;
              let statusClass = "scan-history-valid";

              if (ticketData.vipGuest === "Yes") {
                message += " 🎉 VIP";
                color = "gold";
                sound = soundVIP;
                statusClass = "scan-history-vip";
              }

              showFeedback(message, color, sound, statusClass);
            }

            updateTicketCounts();
          });
        }
      } catch (error) {
        console.error("❌ Error scanning ticket:", error);
        showFeedback(
          "⚠️ Error scanning ticket.",
          "red",
          soundError,
          "scan-history-invalid"
        );
      }

      event.target.value = "";
    }, 100);
  });

function showFeedback(message, color, sound, statusClass) {
  const scanStatus = document.getElementById("scanStatus");
  scanStatus.innerText = message;

  // Remove all possible background classes first
  document.body.classList.remove("flash-green", "flash-red", "flash-gold");

  // Force a small delay before applying the new color (helps browsers refresh correctly)
  setTimeout(() => {
    document.body.classList.add(`flash-${color}`);
    sound.play();
  }, 10); // Tiny delay to reset the background properly

  // Ensure the background resets after 500ms
  setTimeout(() => {
    document.body.classList.remove(`flash-${color}`);
  }, 700);
}

// 🔹 Update Ticket Counts & Progress Circle
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

  updateProgressCircle(checkedInCount, totalTickets);
}

// 🟣 Update Progress Circle UI
function updateProgressCircle(scanned, total) {
  let progressCircle = document.querySelector(".progress-circle");
  let percentage = total > 0 ? (scanned / total) * 100 : 0;
  let angle = (percentage / 100) * 360;

  // 🟣 Set Progress Circle Background
  progressCircle.style.background = `conic-gradient(#6a0dad ${angle}deg, #ddd ${angle}deg)`;

  // Update Percentage Text
  document.querySelector(".progress-text").innerText = `${Math.round(
    percentage
  )}%`;
}

// 🔄 Listen for Real-Time Ticket Updates
function listenForTicketUpdates() {
  if (!eventID) return;

  const ticketsRef = collection(db, eventID);
  onSnapshot(ticketsRef, () => {
    updateTicketCounts();
  });
}

// 🔹 Add Scan Mode Toggle with Confirmation
let scanMode = "in"; // Default to "Scanning In"

const toggleSwitch = document.getElementById("scanToggle");
const toggleLabel = document.getElementById("toggleLabel");

toggleSwitch.addEventListener("change", () => {
  let newMode = toggleSwitch.checked ? "Scanning Out" : "Scanning In";

  // 🔹 Show Confirmation Popup
  let confirmChange = confirm(
    `Are you sure you want to switch to "${newMode}" mode?`
  );

  if (confirmChange) {
    scanMode = toggleSwitch.checked ? "out" : "in";
    toggleLabel.innerText = newMode;
  } else {
    // 🔄 Revert toggle if canceled
    toggleSwitch.checked = !toggleSwitch.checked;
  }
});

// 🔹 Modify Ticket Scanning Logic to Respect Scan Mode
document
  .getElementById("barcodeInput")
  .addEventListener("input", async function (event) {
    let barcode = event.target.value.trim().toLowerCase();
    if (!barcode) return;

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      if (!eventID) {
        showFeedback(
          "⚠️ No Event Found. Upload first.",
          "red",
          soundError,
          "scan-history-invalid"
        );
        return;
      }

      try {
        let ticketsRef = collection(db, eventID);
        let q = query(ticketsRef, where("barcode", "==", barcode));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          showFeedback(
            "❌ Ticket Not Found!",
            "red",
            soundError,
            "scan-history-invalid"
          );
          clearTicketDetails();
        } else {
          querySnapshot.forEach(async (docSnap) => {
            let ticketData = docSnap.data();
            let ticketRef = doc(db, eventID, docSnap.id);

            document.getElementById(
              "ticketName"
            ).innerText = `Name: ${ticketData.name}`;
            document.getElementById(
              "ticketSeat"
            ).innerText = `Seat Number: ${ticketData.seatNumber}`;
            document.getElementById(
              "ticketRow"
            ).innerText = `Row: ${ticketData.rowNumber}`;
            document.getElementById("ticketVIP").innerText = `VIP: ${
              ticketData.vipGuest === "Yes" ? "✅ Yes" : "❌ No"
            }`;

            if (scanMode === "in") {
              if (ticketData.checkedIn) {
                showFeedback(
                  "⚠️ Ticket already checked in!",
                  "red",
                  soundError,
                  "scan-history-invalid"
                );
              } else {
                await updateDoc(ticketRef, { checkedIn: true });

                let message = `✅ ${ticketData.name}`;
                let color = "green";
                let sound = soundSuccess;
                let statusClass = "scan-history-valid";

                if (ticketData.vipGuest === "Yes") {
                  message += " 🎉 VIP";
                  color = "gold";
                  sound = soundVIP;
                  statusClass = "scan-history-vip";
                }

                showFeedback(message, color, sound, statusClass);
              }
            } else {
              if (!ticketData.checkedIn) {
                showFeedback(
                  "⚠️ Ticket was never checked in!",
                  "red",
                  soundError,
                  "scan-history-invalid"
                );
              } else {
                await updateDoc(ticketRef, { checkedIn: false });
                showFeedback(
                  `🔄 ${ticketData.name} Checked Out`,
                  "blue",
                  soundSuccess,
                  "scan-history-valid"
                );
              }
            }

            updateTicketCounts();
          });
        }
      } catch (error) {
        console.error("❌ Error scanning ticket:", error);
        showFeedback(
          "⚠️ Error scanning ticket.",
          "red",
          soundError,
          "scan-history-invalid"
        );
      }

      event.target.value = "";
    }, 100);
  });
