export class InfoPanel {
  #state = {
    match: 0,
    lastWin: null,
    started: false,
    mode: null,
    timeLeft: 0,
    mechanics: { timeless: false },
    leagueLength: 0
  };

   constructor({ progressManager, eventBus }) {
     this.progressManager = progressManager;
     this.eventBus = eventBus;
     this.roundInfoElement = document.getElementById("round-info");

       this._handlers = {
         "game:match-start": (e) => this.#handleMatchStart(e),
         "game:match-end": (e) => this.#handleMatchEnd(e),
         "game:mechanics-change": (e) => this.#handleMechanicsChange(e),
         "progress:update": (e) => this.#handleProgressUpdate(e),
         "tick": (e) => this.#handleTick(e)
       };

     for (const [event, handler] of Object.entries(this._handlers)) {
       this.eventBus.subscribe(event, handler);
     }

     this.draw();
    
   }

    #handleMatchStart({ matchNumber, mode, leagueLength, timeLeft, timeless }) {
      this.#state.match = matchNumber;
      this.#state.mode = mode;
      this.#state.leagueLength = leagueLength;
      if (timeLeft !== undefined) this.#state.timeLeft = timeLeft;
      if (timeless !== undefined) this.#state.mechanics.timeless = timeless;
      this.#state.started = true;
      this.draw();
    }

   #handleMatchEnd({ winners, leagueLength, modeKey }) {
     this.#state.match = 0;
     this.#state.lastWin = winners;
     this.#state.started = false;
     this.#state.mode = { isLeague: true, modeKey, leagueLength };
     this.draw();
   }
    #handleProgressUpdate() {
      this.draw();
    }

    #handleTick({ timeLeft }) {
      this.#state.timeLeft = timeLeft;
      this.draw();
    }

    #handleMechanicsChange({ timeless }) {
      if (timeless !== undefined) {
        this.#state.mechanics.timeless = timeless;
      }
      this.draw();
    }

   destroy() {
     for (const [event, handler] of Object.entries(this._handlers)) {
       this.eventBus.unsubscribe(event, handler);
     }
   }

   draw() {
     const { match, timeLeft, mechanics, lastWin, started, mode, leagueLength } = this.#state;
     const credits = this.progressManager.credits;

     if (this.roundInfoElement) {
       this.roundInfoElement.innerHTML = !started
         ? `<p class="timer-active"><strong>👆 Choose your team to start</strong></p>`
         : `<p><strong class="timer-active">Match:</strong> ${match}${mode?.isLeague && leagueLength ? `/${leagueLength}` : ""}</p>
           ${lastWin ? `<p><strong class="timer-active">Last winner:</strong> ${lastWin}</p>` : ""}
           <p><strong class="timer-active">Credits:</strong> ${credits} 💰</p>
           ${!mechanics?.timeless ? `<p class="timer-active"><strong class="timer-active">Time:</strong> ${Math.round(timeLeft / 1000)}s</p>` : ""}`;
     }
   }
}

