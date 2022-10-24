"use strict";

//////////////////////////////
//OOP Project - MAPTY
//////////////////////////////

//geolocation takes 2 callback functions
//first: called on success. needs position arg.
//second: error callback. it's called when error occurs

//Parent Class for all kind of workouts
//in this class we have data which is
//same for all workouts
class Workout {
  //public instance field
  date = new Date();
  id = (Date.now() + "").slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; //in km
    this.duration = duration; //in minutes
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

//Child class for running workout
//we added cadence (pace)
class Running extends Workout {
  type = "running";

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    //min / km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

//Child class for cycling workout
//we added elevation (speed)
class Cycling extends Workout {
  type = "cycling";

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    //km / h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////
//APPLICATION ARCHITECTURE

//select elements
const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");

//one big class for app architecture
class App {
  //private instance field
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    //we called it here because constructor is
    //triggered first from class
    this._getPosition();

    //Get data from Local Storage
    this._getLocalStorage();

    //Attach Event Handlers
    //submit form (_newWorkout)
    form.addEventListener("submit", this._newWorkout.bind(this));
    //change from cadence to elevation and vise versa
    //move to pop up
    inputType.addEventListener("change", this._toggleElevationField);
    containerWorkouts.addEventListener("click", this._moveToPopup.bind(this));
  }

  //get user's position
  _getPosition() {
    //prevent errors in old browsers
    //we need bind to point this. to current object
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert(`Could not get your position`);
        }
      );
    }
  }

  //make map visible based on user's position
  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map("map").setView(coords, this.#mapZoomLevel);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    //on method is from leaflet library (addEventListener)
    this.#map.on("click", this._showForm.bind(this));

    //render the markers on the map from local storage
    this.#workouts.forEach((work) => this._renderWorkoutMarker(work));
  }

  //show form after user clicks on the map
  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove("hidden");
    inputDistance.focus();
  }

  //hide form after submitting
  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        "";

    form.style.display = "none";
    form.classList.add("hidden");
    setTimeout(() => (form.style.display = "grid"), 1000);
  }

  //change cadence/elevation fields
  _toggleElevationField() {
    inputElevation.closest(".form__row").classList.toggle("form__row--hidden");
    inputCadence.closest(".form__row").classList.toggle("form__row--hidden");
  }

  //data for new workout
  //this is called in App class constructor when user submits form
  _newWorkout(e) {
    //small helper functions
    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    //remove default behavior
    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // if workout is running, create running object
    if (type === "running") {
      const cadence = +inputCadence.value;

      //check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        return alert("Inputs have to be positive numbers.");
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // if workout is cycling, create cycling object
    if (type === "cycling") {
      const elevation = +inputElevation.value;

      //check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        return alert("Inputs have to be positive numbers.");
      }
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new object to workouts array
    this.#workouts.push(workout);

    // render workout on map as marker
    //display marker
    this._renderWorkoutMarker(workout);

    // render workout on list
    this._renderWorkout(workout);

    //hide form and clear input fields
    this._hideForm();

    //set local storage to all workouts
    this._setLocalStorage();
  }

  //workout marker
  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.description}`
      )
      .openPopup();
  }

  //render workout in list
  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        `;

    if (workout.type === "running") {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
    </li>
      `;
    }

    if (workout.type === "cycling") {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
    </li>
      `;
    }
    form.insertAdjacentHTML("afterend", html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest(".workout");

    if (!workoutEl) {
      return;
    }

    const workout = this.#workouts.find(
      (work) => work.id === workoutEl.dataset.id
    );

    this.AnimationOptions = {
      animate: true,
      pan: {
        duration: 1,
      },
    };

    this.#map.setView(
      workout.coords,
      this.#mapZoomLevel,
      this.AnimationOptions
    );

    //using public interface
    workout.click();
  }

  //use local storage
  _setLocalStorage() {
    //first arg: name
    //second arg: string - JSON.stringify()
    //JSON.stringify() - convert obj to string
    localStorage.setItem("workouts", JSON.stringify(this.#workouts));
  }

  //get data from LS
  _getLocalStorage() {
    //JSON.parse() - converts strings to objects
    const data = JSON.parse(localStorage.getItem("workouts"));

    if (!data) {
      return;
    }

    //retrieve data from local storage
    this.#workouts = data;

    //render data in the list
    this.#workouts.forEach((work) => this._renderWorkout(work));

    //restore prototype chain
    data.forEach(
      (d) =>
        (d.__proto__ =
          d.type === "running" ? Running.prototype : Cycling.prototype)
    );

    //WE CAN NOT RENDER MARKERS FROM THIS METHOD
    //THIS METHOD IS CALLED RIGHT AFTER PAGE LOADS
    //MAP IS NOT LOADED YET
    //WE PASS MARKER CODE IN _loadMap METHOD
  }

  reset() {
    localStorage.removeItem("workouts");
    location.reload();
  }
}

//object created as soon as page loads
const app = new App();
