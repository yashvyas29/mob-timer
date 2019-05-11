const Timer = require('./timer')
const Mobbers = require('./mobbers')
const clipboard = require('../clipboard')

const defaultSound = null
const defaultSoundTimes = [0]

class TimerState {
  constructor(options) {
    if (!options) {
      options = {}
    }
    this.secondsPerTurn = 600
    this.mobbers = new Mobbers()
    this.secondsUntilFullscreen = 30
    this.snapThreshold = 25
    this.alertSound = defaultSound
    this.alertSoundTimes = defaultSoundTimes
    this.timerAlwaysOnTop = true
    this.shuffleMobbersOnStartup = false
    this.clearClipboardHistoryOnTurnEnd = false
    this.numberOfItemsClipboardHistoryStores = 25

    this.currentMobber = 0
    this.secondsRemaining = this.secondsPerTurn
    this.TimerClass = options.Timer || Timer
    if (this.TimerClass !== Timer) {
      this.createTimers()
    }
  }

  setCallback(callback) {
    this.callback = callback
  }

  createTimers() {
    this.mainTimer = new this.TimerClass({ countDown: true, time: this.secondsPerTurn }, secondsRemaining => {
      this.dispatchTimerChange(secondsRemaining)
      if (secondsRemaining < 0) {
        this.pause()
        this.rotate()
        this.callback('turnEnded')
        this.startAlerts()

        if (this.clearClipboardHistoryOnTurnEnd) {
          clipboard.clearClipboardHistory(this.numberOfItemsClipboardHistoryStores)
        }
      }
    })

    this.alertsTimer = new this.TimerClass({ countDown: false }, alertSeconds => {
      this.callback('alert', alertSeconds)
    })
  }

  dispatchTimerChange(secondsRemaining) {
    this.secondsRemaining = secondsRemaining
    this.callback('timerChange', {
      secondsRemaining,
      timeRemaining: this.getTimeRemaining(secondsRemaining),
      secondsPerTurn: this.secondsPerTurn
    })
  }

  reset(stop = false) {
    if (stop) {
      this.mainTimer.pause()
      this.callback('turnEnded')
    }
    this.mainTimer.reset(this.secondsPerTurn)
    this.stopAlerts()
    this.dispatchTimerChange(this.secondsPerTurn)
  }

  startAlerts() {
    this.alertsTimer.reset(0)
    this.alertsTimer.start()
    this.callback('alert', 0)
  }

  stopAlerts() {
    this.alertsTimer.pause()
    this.alertsTimer.reset(0)
    this.callback('stopAlerts')
  }

  startRemaining() {
    const isRemaining = this.secondsRemaining < this.secondsPerTurn
    if (isRemaining) {
      this.start()
    }
  }

  start() {
    this.mainTimer.start()
    this.callback('started')
    this.stopAlerts()
  }

  pause() {
    this.mainTimer.pause()
    this.callback('paused')
    this.stopAlerts()
  }

  rotate() {
    this.reset(true)
    this.mobbers.rotate()
    this.currentMobber = this.mobbers.currentMobber
    this.callback('configUpdated', this.getState())
    let data = this.mobbers.getCurrentAndNextMobbers()
    data.timeRemaining = this.getTimeRemaining(this.secondsRemaining)
    this.callback('rotated', data)
  }

  initialize() {
    let data = this.mobbers.getCurrentAndNextMobbers()
    data.timeRemaining = this.getTimeRemaining(this.secondsRemaining)
    if (this.mainTimer.interval) {
      data.isTimerRunning = true
    }
    data.isTimeRemaining = this.secondsRemaining < this.secondsPerTurn
    this.callback('initialized', data)
  }

  publishConfig() {
    this.initialize()
    this.callback('configUpdated', this.getState())
  }

  addMobber(mobber) {
    this.mobbers.addMobber(mobber)
    this.publishConfig()
  }

  removeMobber(mobber) {
    let currentMobber = this.mobbers.getCurrentAndNextMobbers().current
    let isRemovingCurrentMobber = currentMobber ? currentMobber.name === mobber.name : false

    this.mobbers.removeMobber(mobber)

    if (isRemovingCurrentMobber) {
      this.pause()
      this.reset()
      this.callback('turnEnded')
    }

    this.publishConfig()
  }

  updateMobber(mobber) {
    const currentMobber = this.mobbers.getCurrentAndNextMobbers().current
    const disablingCurrentMobber = (currentMobber.id === mobber.id && mobber.disabled)

    this.mobbers.updateMobber(mobber)

    if (disablingCurrentMobber) {
      this.pause()
      this.reset()
      this.callback('turnEnded')
    }

    this.publishConfig()
  }

  setSecondsPerTurn(value) {
    this.secondsPerTurn = value
    this.secondsRemaining = value
    this.publishConfig()
    this.reset()
  }

  setSecondsUntilFullscreen(value) {
    this.secondsUntilFullscreen = value
    this.publishConfig()
  }

  setSnapThreshold(value) {
    this.snapThreshold = value
    this.publishConfig()
  }

  setAlertSound(soundFile) {
    this.alertSound = soundFile
    this.publishConfig()
  }

  setAlertSoundTimes(secondsArray) {
    this.alertSoundTimes = secondsArray
    this.publishConfig()
  }

  setTimerAlwaysOnTop(value) {
    this.timerAlwaysOnTop = value
    this.publishConfig()
  }

  setShuffleMobbersOnStartup(value) {
    this.shuffleMobbersOnStartup = value
    this.publishConfig()
  }

  shuffleMobbers() {
    this.mobbers.shuffleMobbers()
    this.publishConfig()
  }

  setClearClipboardHistoryOnTurnEnd(value) {
    this.clearClipboardHistoryOnTurnEnd = value
    this.publishConfig()
  }

  setNumberOfItemsClipboardHistoryStores(value) {
    this.numberOfItemsClipboardHistoryStores = value
    this.publishConfig()
  }

  getState() {
    return {
      mobbers: this.mobbers.getAll(),
      secondsPerTurn: this.secondsPerTurn,
      secondsUntilFullscreen: this.secondsUntilFullscreen,
      snapThreshold: this.snapThreshold,
      alertSound: this.alertSound,
      alertSoundTimes: this.alertSoundTimes,
      timerAlwaysOnTop: this.timerAlwaysOnTop,
      shuffleMobbersOnStartup: this.shuffleMobbersOnStartup,
      clearClipboardHistoryOnTurnEnd: this.clearClipboardHistoryOnTurnEnd,
      numberOfItemsClipboardHistoryStores: this.numberOfItemsClipboardHistoryStores,
      currentMobber: this.currentMobber,
      secondsRemaining: this.secondsRemaining
    }
  }

  loadState(state) {
    if (state.mobbers) {
      state.mobbers.forEach(x => this.mobbers.addMobber(x))
    }

    if (typeof state.secondsPerTurn === 'number') {
      this.secondsPerTurn = state.secondsPerTurn
    }
    if (typeof state.secondsUntilFullscreen === 'number') {
      this.secondsUntilFullscreen = state.secondsUntilFullscreen
    }
    if (typeof state.snapThreshold === 'number') {
      this.snapThreshold = state.snapThreshold
    }
    this.alertSound = state.alertSound || defaultSound
    this.alertSoundTimes = state.alertSoundTimes || defaultSoundTimes
    if (typeof state.timerAlwaysOnTop === 'boolean') {
      this.timerAlwaysOnTop = state.timerAlwaysOnTop
    }
    this.shuffleMobbersOnStartup = !!state.shuffleMobbersOnStartup
    this.clearClipboardHistoryOnTurnEnd = !!state.clearClipboardHistoryOnTurnEnd
    this.numberOfItemsClipboardHistoryStores = Math.floor(state.numberOfItemsClipboardHistoryStores) > 0 ? Math.floor(state.numberOfItemsClipboardHistoryStores) : 1

    if (typeof state.currentMobber === 'number') {
      this.currentMobber = state.currentMobber
      this.mobbers.currentMobber = state.currentMobber
    }
    this.secondsRemaining = this.secondsPerTurn

    this.createTimers()
  }

  getTimeRemaining(secondsRemaining) {
    let minutes = parseInt(secondsRemaining / 60).toString()
    if (minutes.length === 1) {
      minutes = '0' + minutes
    }
    let seconds = parseInt(secondsRemaining % 60).toString()
    if (seconds.length === 1) {
      seconds = '0' + seconds
    }
    return (minutes + ':' + seconds)
  }
}

module.exports = TimerState
