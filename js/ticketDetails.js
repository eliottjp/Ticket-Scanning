import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js";

// 🔹 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCd5lYY7EAkxYzV_lbolu7KFx8nTEHiLug",
  authDomain: "ticket-scanner-2b7f1.firebaseapp.com",
  projectId: "ticket-scanner-2b7f1",
  storageBucket: "ticket-scanner-2b7f1.firebasestorage.app",
  messagingSenderId: "431290258037",
  appId: "1:431290258037:web:73fa6d44e5335c37989e3c",
};

// 🔹 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔹 Elements
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const ticketDetails = document.getElementById("ticketDetails");
const ticketName = document.getElementById("ticketName");
const ticketSeat = document.getElementById("ticketSeat");
const ticketRow = document.getElementById("ticketRow");
const ticketVIP = document.getElementById("ticketVIP");
const ticketCheckedIn = document.getElementById("ticketCheckedIn");
const resultsList = document.getElementById("resultsList");

// 🎵 Load Sound Effects
const soundSuccess = new Audio("sounds/success.mp3"); // ✅ Green
const soundError = new Audio("sounds/error.mp3"); // ❌ Red

let debounceTimeout;

// 🔹 Handle Search Input
searchInput.addEventListener("input", async function (event) {
  let searchTerm = event.target.value.trim().toLowerCase();
  if (searchTerm.length < 3) {
    resultsList.style.display = "none";
    return; // Show results only after 3 characters
  }

  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(async () => {
    let eventID = localStorage.getItem("eventID");
    if (!eventID) {
      alert("⚠️ No Event Found. Upload first.");
      return;
    }

    try {
      let ticketsRef = collection(db, eventID);
      let q = query(
        ticketsRef,
        where("name", ">=", searchTerm),
        where("name", "<=", searchTerm + "\uf8ff")
      );
      let querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        resultsList.innerHTML = "";
        querySnapshot.forEach((docSnap) => {
          let ticketData = docSnap.data();
          let listItem = document.createElement("li");
          listItem.textContent = ticketData.name;
          listItem.addEventListener("click", () => {
            showTicketDetails(docSnap.id);
          });
          resultsList.appendChild(listItem);
        });
        resultsList.style.display = "block";
      } else {
        resultsList.style.display = "none";
      }
    } catch (error) {
      console.error("Error fetching ticket data:", error);
    }
  }, 300);
});

// 🔹 Show Ticket Details
async function showTicketDetails(ticketID) {
  let eventID = localStorage.getItem("eventID");
  try {
    let ticketRef = collection(db, eventID);
    let docSnap = await getDocs(
      query(ticketRef, where("__name__", "==", ticketID))
    );
    if (!docSnap.empty) {
      let ticketData = docSnap.docs[0].data();
      ticketName.textContent = `Name: ${ticketData.name.replace("-", " ")}`;
      ticketSeat.textContent = `Seat: ${ticketData.seatNumber}`;
      ticketRow.textContent = `Row: ${ticketData.rowNumber}`;
      ticketVIP.textContent = `VIP: ${ticketData.vipGuest}`;
      ticketCheckedIn.textContent = `Checked In: ${
        ticketData.checkedIn ? "Yes" : "No"
      }`;
      ticketDetails.style.display = "block";
    } else {
      alert("Ticket details not found.");
    }
  } catch (error) {
    console.error("Error fetching ticket details:", error);
  }
}
