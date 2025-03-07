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
let tickets = {}; // Local ticket storage
let debounceTimeout;

document.addEventListener("DOMContentLoaded", function () {
  const barcodeInput = document.getElementById("barcodeInput");

  // Keep the input focused
  function keepFocus() {
    barcodeInput.focus();
  }
  keepFocus();
  document.body.addEventListener("click", keepFocus);

  // Listen for scan data
  function handleScan(event) {
    const scannedData = event.detail.data;
    barcodeInput.value = scannedData; // Insert scanned barcode into input field
    console.log("Scanned Data: ", scannedData);
  }

  document.addEventListener("scanData", handleScan);

  // Register DataWedge Intent Listener
  function registerDataWedgeListener() {
    if (window.ZebraBridge) {
      window.ZebraBridge.registerBroadcastReceiver(
        "com.zebra.browser.ACTION",
        function (data) {
          console.log("Received scan:", data);
          barcodeInput.value = data["com.symbol.datawedge.data_string"] || "";
        }
      );
    } else {
      console.error("ZebraBridge API not available.");
    }
  }

  registerDataWedgeListener();
});

async function downloadTickets() {
  if (!eventID) return;

  // Check if tickets are already downloaded
  const storedTickets = localStorage.getItem(`tickets_${eventID}`);
  if (storedTickets) {
    console.log("✅ Tickets already downloaded, using local storage.");
    tickets = JSON.parse(storedTickets);
    return;
  }

  console.log("📥 Downloading tickets...");
  const eventRef = collection(db, eventID);
  const snapshot = await getDocs(eventRef);

  tickets = {};
  snapshot.forEach((doc) => {
    tickets[doc.id] = doc.data();
  });

  localStorage.setItem(`tickets_${eventID}`, JSON.stringify(tickets));
  console.log("✅ Tickets saved locally!");
}

// 🔹 Fetch latest event details from Firestore & Store in Local Storage
async function fetchEventID() {
  const globalRef = doc(db, "GlobalSettings", "CurrentEvent");
  const docSnap = await getDoc(globalRef);

  if (docSnap.exists()) {
    eventID = docSnap.data().eventID;
    console.log(`📂 Active Event ID: ${eventID}`);

    if (!eventID) {
      console.warn("⚠️ eventID is undefined or empty!");
      return;
    }

    // 🛠️ Split eventID to extract name and date
    const parts = eventID.split("_");
    if (parts.length < 3) {
      console.warn("⚠️ Unexpected eventID format!");
      return;
    }

    const eventDate = parts.pop(); // Last part is the date
    const eventName = parts.join(" "); // Remaining parts are the name

    console.log(`📅 Event Name: ${eventName}`);
    console.log(`📆 Event Date: ${eventDate}`);

    // Store event details in localStorage
    localStorage.setItem("eventID", eventID);
    localStorage.setItem("eventName", eventName);
    localStorage.setItem("eventDate", eventDate);

    // Update UI
    const eventElement = document.getElementById("currentEvent");
    if (eventElement) {
      eventElement.innerHTML = `<strong>📅 ${eventName} | ${eventDate}</strong>`;
    }

    // Start listening for ticket updates & update counts
    listenForTicketUpdates();
    updateTicketCounts();
  } else {
    console.log("⚠️ No active event found!");

    // Try to load from localStorage as a fallback
    const storedEventID = localStorage.getItem("eventID");
    if (storedEventID) {
      eventID = storedEventID;
      const storedEventName = localStorage.getItem("eventName");
      const storedEventDate = localStorage.getItem("eventDate");

      console.log("📂 Using locally stored event data.");
      console.log(`📅 Event Name: ${storedEventName}`);
      console.log(`📆 Event Date: ${storedEventDate}`);

      const eventElement = document.getElementById("currentEvent");
      if (eventElement) {
        eventElement.innerHTML = `<strong>📅 ${storedEventName} | ${storedEventDate}</strong>`;
      }
    } else {
      const eventElement = document.getElementById("currentEvent");
      if (eventElement) {
        eventElement.innerText = "⚠️ No event uploaded.";
      }
    }
  }
}

// 🔄 Auto-update scanner when a new event is uploaded
onSnapshot(doc(db, "GlobalSettings", "CurrentEvent"), async () => {
  console.log("🔄 Event Updated!");
  await fetchEventID();
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
  }, 900);
}

// 🔹 Update Ticket Counts & Progress Circle
async function updateTicketCounts() {
  if (!eventID) return;

  let storedTickets =
    JSON.parse(localStorage.getItem(`tickets_${eventID}`)) || [];
  let totalTickets = storedTickets.length;
  let checkedInCount = storedTickets.filter(
    (ticket) => ticket.checkedIn
  ).length;
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

// 🔹 Modify Ticket Scanning Logic to Respect Scan Mode & Optimize with Local Storage

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
        // 🔍 Check localStorage first for faster lookup
        let storedTickets =
          JSON.parse(localStorage.getItem(`tickets_${eventID}`)) || [];
        let ticketData = storedTickets.find(
          (ticket) => ticket.barcode === barcode
        );

        if (!ticketData) {
          // 📡 Query Firestore only if ticket isn't in localStorage
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
            return;
          }

          querySnapshot.forEach((docSnap) => {
            ticketData = docSnap.data();
            ticketData.id = docSnap.id;
            storedTickets.push(ticketData); // Store newly found ticket in local cache
          });

          // 🏷️ Save updated tickets back to localStorage
          localStorage.setItem(
            `tickets_${eventID}`,
            JSON.stringify(storedTickets)
          );
        }

        if (ticketData) {
          let ticketRef = doc(db, eventID, ticketData.id);

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
              await updateDoc(ticketRef, {
                checkedIn: true,
                timestamp: new Date().toISOString(),
              });

              ticketData.checkedIn = true;
              ticketData.timestamp = new Date().toISOString();

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
              await updateDoc(ticketRef, {
                checkedIn: false,
                timestamp: null,
              });

              ticketData.checkedIn = false;
              ticketData.timestamp = null;

              showFeedback(
                `🔄 ${ticketData.name} Checked Out`,
                "blue",
                soundSuccess,
                "scan-history-valid"
              );
            }
          }

          // 🏷️ Save updated ticket back to localStorage
          localStorage.setItem(
            `tickets_${eventID}`,
            JSON.stringify(storedTickets)
          );

          updateTicketCounts();
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

document.addEventListener("DOMContentLoaded", function () {
  const scannerModal = document.getElementById("scannerModal");
  const startQRScannerButton = document.getElementById("startQRScanner");
  const closeModalButton = document.querySelector(".close");
  const scannerElement = document.getElementById("scanner");
  const barcodeInput = document.getElementById("barcodeInput"); // Input field
  const scanResult = document.getElementById("modalScanResult"); // Scan result display
  let scanner = null;

  function startScanner() {
    if (!scanner) {
      scanner = new Html5Qrcode("scanner");
    }

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decodedText) => {
          handleScan(decodedText); // Process scanned data
        },
        (errorMessage) => console.log("Scanning error:", errorMessage)
      )
      .catch((err) => console.error("Scanner error:", err));
  }

  function stopScanner() {
    if (scanner) {
      scanner
        .stop()
        .then(() => {
          scanner.clear();
        })
        .catch((err) => console.error("Error stopping scanner:", err));
    }
  }

  function openScannerModal() {
    scannerModal.style.display = "flex";
    startScanner();
  }

  function closeScannerModal() {
    scannerModal.style.display = "none";
    stopScanner();
  }

  function handleScan(barcode) {
    scanResult.textContent = `Scanned: ${barcode}`;

    // Insert scanned barcode into input field
    barcodeInput.value = barcode;
    barcodeInput.focus();

    // Close modal immediately
    closeScannerModal();

    // Delay validation by 1 second
    setTimeout(() => {
      barcodeInput.dispatchEvent(new Event("input", { bubbles: true })); // Trigger validation
    }, 1000);
  }

  startQRScannerButton.addEventListener("click", openScannerModal);
  closeModalButton.addEventListener("click", closeScannerModal);

  window.addEventListener("click", function (event) {
    if (event.target === scannerModal) {
      closeScannerModal();
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "zebra") {
    document.querySelector(".search-icon").style.display = "none";
  }
});

window.onload = function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "zebra") {
    document.body.classList.add("zebra-mode");
  }
};
