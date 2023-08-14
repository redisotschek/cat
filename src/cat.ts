import { Application, Text, TextStyle } from "pixi.js";
import { sound } from '@pixi/sound';
import { Cat, Vector, getCardinal } from "./CatPixiInstance";

const app: Application<HTMLCanvasElement> = new Application(
    {
        backgroundAlpha: 0,
        resizeTo: window,
    }
);

const textStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 36,
    fill: 'white',
})

class Brain {
    aiIntentCompleted = new Event('aiIntentCompleted');
    aiStepCompleted = new Event('aiStepCompleted');
    behaviorChanged = new Event('behaviorChanged');
    attentionLost = new Event('attentionLost');
    isActive: boolean;
    nextIntent: Function[] = [];
    _currentBehaviorState = '';
    callbacks: Function[] = [];
    attentionCaptured: boolean = false;
    attentionCount = 0;
    attentionTimer: ReturnType<typeof setInterval>;
    set currentBehaviorState(state) {
        this._currentBehaviorState = state;
        dispatchEvent(this.behaviorChanged);
    }
    get currentBehaviorState() {
        return this._currentBehaviorState;
    }
    setAttentionTimer () {
        this.attentionTimer = setInterval(() => {
            console.log(this.attentionCount);
            if (this.attentionCount <= 0) {
                return this.clearAttention();
            }
            if (this.attentionCount > 0) {
                return this.attentionCount--;
            }
        }, 1000);
    }
    poke() {
        this.attentionCount++;
        if (this.attentionCount > 5) {
            this.attentionCaptured = true;
            this.setAttentionTimer();
        }
        return this.attentionCaptured;
    }
    clearAttention() {
        clearInterval(this.attentionTimer);
        dispatchEvent(this.attentionLost);
        this.attentionCount = 0;
        this.attentionCaptured = false;
    }
    clearIntents() {
        this.nextIntent = [];
        this.callbacks = [];
    }
    addIntent(intent: string = '', callbacks: Function[] = []) {
        this.currentBehaviorState = intent;
        this.isActive = true;
        this.callbacks = callbacks;
        this.nextCallback();
    }
    addNextIntent(intent: Function) {
        this.nextIntent.push(intent);
    }
    nextCallback() {
        if (this.isActive) {
            const callback = this.callbacks.shift();
            if (callback) {
                callback();
            } else {
                this.isActive = false;
                this.currentBehaviorState = '';
                dispatchEvent(this.aiIntentCompleted);
            }
        } 
    }
}

const nocursor = document.createElement('style');
nocursor.innerHTML = '.nocursor { cursor: none; }';

const currStateText = new Text('empty', textStyle);
const aiStateText = new Text('empty', textStyle);

aiStateText.y = 50;

app.stage.addChild(currStateText, aiStateText);

document.body.appendChild(app.view);

export class SmartCat extends Cat {
    aiIntents = ['sit', 'zoom', 'laydown', 'look_around']; // hunt 
    // aiIntents: string[] = ['zoom']; // debug 
    aiTimer: number = 0;
    brain: Brain = new Brain();
    isHunting: boolean = false;
    isPlayingFor: number = 0;
    currentMousePosition: Vector = new Vector(0, 0);
    isMouseCaptured: boolean;
    constructor(app: Application, document: Document = window.document) {
        super(app, document);
        this.loadTextures().then(() => {
            this.init();
        });
    }
    stateManager(delta: number): void {
        super.stateManager(delta);
        if (!this.target) {
            return this.ai(delta);
        }
    }
    async loadTextures(): Promise<void> {
        this.zoomSounds.forEach((s, i) => {
            sound.add('zoom'+i, s);
        });
        return super.loadTextures();
    }
    clickListener(event: MouseEvent): void {
        if (this.isMouseCaptured) return;
        if (!this.isHunting) {
            const attentionCaptured = this.brain.poke();
            if (attentionCaptured) {
                this.currentMousePosition = new Vector(event.clientX, event.clientY);
                this.aiMethods.hunt();
            }
        }
    }
    mouseMoveListener(event: MouseEvent): void {
        if (this.isMouseCaptured) return;
        this.currentMousePosition = new Vector(event.clientX, event.clientY);
        if (this.isHunting) {
            setTimeout(() => {
                this.setTarget(new Vector(event.clientX, event.clientY), 'running');
            }, 200);
        }
    }
    ai (delta: number) {
        this.aiTimer+=delta;
        if (this.brain.isActive) {
            this.brain.nextCallback();
        } else {
            if (this.brain.nextIntent.length > 0) {
                const cb = this.brain.nextIntent.shift();
                cb();
            }
        }

        const maxStateTime = 500;
        if (!this.target && this.stateTimer > maxStateTime) {
            this.aiMethods.chooseRandomIntent();
        }
    }
    lockMouse() {
        this.isMouseCaptured = true;
        this.document.body.classList.add('nocursor');
    }
    unlockMouse() {
        this.isMouseCaptured = false;
        this.document.body.classList.remove('nocursor');
    }
    aiMethods: Record<string, Function> = {
        chooseRandomIntent: () => {
            this.aiMethods.walkSomeWhere();
            this.brain.addNextIntent(() => {
                this.target = null;
                this.setDefaultState();
                const randomIntent = this.aiIntents[Math.floor(Math.random() * this.aiIntents.length)];
                if (randomIntent) {
                    this.aiMethods[randomIntent]();
                }
            })
            
        },
        walkSomeWhere: () => {
            return this.brain.addIntent('walkSomeWhere', [
                () => {
                    const randomX = Math.floor(Math.random() * this.app.screen.width);
                    const randomY = Math.floor(Math.random() * this.app.screen.height);
                    const randomTarget = new Vector(randomX, randomY);
                    this.setTarget(randomTarget);
                }
            ]);
        },
        zoom: () => {
            //add callbacks for moving around screen
            this.aiMethods.sit();
            this.brain.addNextIntent(() => {
                const randomY1 = Math.floor(Math.random() * this.app.screen.height);
                const randomX1 = Math.random() > 0.5 ? -100 : this.app.screen.width + 100;
                const randomX2 = randomX1 === -100 ? this.app.screen.width + 100 : -100;
                const randomY2 = Math.ceil(Math.random() * this.app.screen.height);
                const randomFinishX = Math.floor(Math.random() * this.app.screen.width);
                const randomFinishY = Math.floor(Math.random() * this.app.screen.height);
                const randSoundIndex = Math.floor(Math.random()*this.zoomSounds.length);
                const callbacks = [
                    () => {
                        const firstTarget = new Vector(randomX1, randomY1)
                        this.setTarget(firstTarget, 'running');
                    },
                    () => {
                        const secondTarget = new Vector(randomX2, randomY2);
                        this.setTarget(secondTarget, 'running');
                        this.currentMusic = 'zoom'+randSoundIndex
                        sound.play(this.currentMusic, {
                            volume: 0.5,
                        });
                    },
                    () => {
                        this.setTarget(new Vector(randomFinishX, randomFinishY), 'running');
                    },
                ];
                this.brain.addIntent('zoom', callbacks);
            });
        },
        sit: () => {
            if (this.currState === 'sitting' || this.currState === 'sitting_down' || this.currState === 'looking_around') return;
            this.brain.addIntent('sit', [
                () => {
                    this.randomSouthDirection();
                    this.currState = 'sitting_down';
                }
            ]);
        },
        laydown: () => {
            this.brain.addIntent('laydown', [
                () => {
                    this.currState = 'laying_down';
                }
            ]);
        },
        look_around: () => {
            this.brain.addIntent('look_around', [
                () => {
                    this.randomSouthDirection();
                    this.currState = 'looking_around';
                }
            ]);
        },
        hunt: () => {
            this.brain.clearIntents();
            this.isHunting = true;
            this.customFps = 60;
            this.brain.addIntent('hunt', [
                () => {
                    this.currState = 'laying_down';
                }
            ]);
        },
        stopHunt: () => {
            this.brain.clearIntents();
            this.brain.addIntent('stopHunt', [
                () => {
                    this.randomSouthDirection();
                    this.currState = 'looking_around';
                }
            ]);
        },
        catchMouse: () => {
            this.aiMethods.stopHunt();
            this.brain.addIntent('catchMouse', [
                () => {
                    this.customFps = 60;
                    this.currState = 'laying_down';
                    this.lockMouse();
                    this.brain.addNextIntent(() => {
                        this.isHunting = false;
                    })
                }
            ]);
        }
    }
    init() {
        super.init();
        const eventsObj = {
            targetReached: addEventListener('targetReached', () => {
                if (this.isHunting) {
                    if (this.isTargetReached(this.currentMousePosition)) {
                        return this.aiMethods.catchMouse();
                    }
                    this.aiMethods.look_around();
                } else {
                    this.setDefaultState();
                }
            }),
            attentionLost: addEventListener('attentionLost', () => {
                this.isHunting = false;
                this.unlockMouse();
            }),
            aiStepCompleted: addEventListener('aiStepCompleted', () => {
                this.brain.nextCallback();
            }),
            aiIntentCompleted: addEventListener('aiIntentCompleted', () => {
                this.aiTimer = 0;
                if (this.currentMusic) {
                    sound.stop(this.currentMusic);
                }
            }),
            stateChanged: addEventListener('stateChanged', () => {
                currStateText.text = `Current state: ${this.currState}`;
            }),
            behaviorChanged: addEventListener('behaviorChanged', () => {
                aiStateText.text = `Current ai state: ${this.brain.currentBehaviorState}`;
            })
        };
        document.head.appendChild(nocursor);
    }
}


const cat = new SmartCat(app, window.document);