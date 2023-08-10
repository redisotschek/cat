import { Application, Text, TextStyle } from "pixi.js";
import { sound } from '@pixi/sound';
import { Cat, Vector } from "./CatPixiInstance";

const app: Application<HTMLCanvasElement> = new Application(
    {
        backgroundAlpha: 0,
        resizeTo: window,
    }
);

const textStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 36,
    fill: 'black',
})

type AiBrain = {
    isControlled: boolean;
    nextIntent: string;
    stateMachine: Function[];
    nextCallback: Function;
}

const currStateText = new Text('empty', textStyle);
const aiStateText = new Text('empty', textStyle);

aiStateText.y = 50;

app.stage.addChild(currStateText, aiStateText);

document.body.appendChild(app.view);

export class SmartCat extends Cat {
    _currentBehaviorState = '';
    set currentBehaviorState(state) {
        console.log('setting state', state)
        this._currentBehaviorState = state;
        dispatchEvent(this.behaviorChanged);
    }
    get currentBehaviorState() {
        return this._currentBehaviorState;
    }
    behaviorChanged = new Event('behaviorChanged');
    aiIntentCompleted = new Event('aiIntentCompleted');
    aiIntents = ['sit', 'zoom', 'laydown', 'look_around']; // hunt 
    // aiIntents = ['zoom']; // debug 
    aiTimer: number = 0;
    aiBrain: AiBrain = {
        isControlled: false,
        nextIntent: '',
        stateMachine: [], //callbacks to perform
        nextCallback: () => {
            if (this.aiBrain.isControlled) {
                const prevStateMachineLength = this.aiBrain.stateMachine.length;
                if (prevStateMachineLength === 0) {
                    console.log('AI: no more states to perform')
                    dispatchEvent(this.aiIntentCompleted);
                    return;
                }
                const cb = this.aiBrain.stateMachine.shift();
                if (cb) {
                    console.log('AI: performing next state')
                    cb();
                }
                if (this.aiBrain.stateMachine.length > prevStateMachineLength) {
                    console.log('AI: no more states to perform')
                    dispatchEvent(this.aiIntentCompleted);
                    return;
                }
            }
            
        },
    }
    constructor() {
        super(app);
        this.loadTextures().then(() => {
            this.init();
        });
    }
    stateManager(delta: number): void {
        super.stateManager(delta);
        if (!this.target) {
            return this.ai();
        }
    }
    async loadTextures(): Promise<void> {
        this.zoomSounds.forEach((s, i) => {
            sound.add('zoom'+i, s);
        });
        return super.loadTextures();
    }
    ai () {
        const brain = this.aiBrain;
        const methods = this.aiMethods;
        const {nextIntent} = brain;
        if (!this.currentBehaviorState) {
            this.aiBrain.isControlled = false;
        }
        if (nextIntent && !this.currentBehaviorState) {
           this.currentBehaviorState = nextIntent;
            methods.chooseIntent();
            if (methods[this.currentBehaviorState]) {
                methods[this.currentBehaviorState]();
            }
        }
        brain.nextCallback();

        const maxStateTime = 500;
        if (!this.target && this.stateTimer > maxStateTime) {
            dispatchEvent(this.aiIntentCompleted);
            methods.chooseRandomIntent();
        }
    }
    aiMethods: Record<string, Function> = {
        setBrain: (callbacks: Function[] = []) => {
            this.aiBrain.isControlled = true;
            if (callbacks.length !== 0) {
                this.aiBrain.stateMachine = callbacks;
            }
        },
        chooseIntent: (intent = '') => {
            this.aiBrain.nextIntent = intent;
        },
        chooseRandomIntent: () => {
            console.log('Choosing Random State')
            this.setDefaultState();
            const randomIntent = this.aiIntents[Math.floor(Math.random() * this.aiIntents.length)];
            console.log('randomIntent', randomIntent)
            this.aiMethods.chooseIntent(randomIntent);
        },
        zoom: () => {
            //add callbacks for moving around screen
            const randomY1 = Math.floor(Math.random() * app.screen.height);
            const randomX1 = Math.random() > 0.5 ? -100 : app.screen.width + 100;
            const randomX2 = randomX1 === -100 ? app.screen.width + 100 : -100;
            const randomY2 = Math.ceil(Math.random() * app.screen.height);
            const randomFinishX = Math.floor(Math.random() * app.screen.width);
            const randomFinishY = Math.floor(Math.random() * app.screen.height);
            const randSoundIndex = Math.floor(Math.random()*this.zoomSounds.length);
            const callbacks = [
                () => {
                    const firstTarget = new Vector(randomX1, randomY1)
                    this.setTarget(firstTarget);
                },
                () => {
                    const secondTarget = new Vector(randomX2, randomY2);
                    this.setTarget(secondTarget);
                    this.currentMusic = 'zoom'+randSoundIndex
                    sound.play(this.currentMusic, {
                        volume: 0.5,
                    });
                },
                () => {
                    this.setTarget(new Vector(randomFinishX, randomFinishY));
                    const listener: Record<string, any> = {
                        targetReached: addEventListener('targetReached', (e) => {
                            if (this.currentMusic) {
                                sound.stop(this.currentMusic);
                            }
                            return removeEventListener('targetReached', listener.targetReached);
                        })
                    }
                }
            ];
            this.aiMethods.setBrain(callbacks);
        },
        sit: () => {
            if (this.currState === 'sitting' || this.currState === 'sitting_down') return;
            this.randomSouthDirection();
            this.currState = 'sitting_down';
            this.aiMethods.setBrain();
        },
        laydown: () => {
            this.randomSouthDirection();
            this.currState = 'laying_down';
            this.aiMethods.setBrain();
        },
        look_around: () => {
            this.randomSouthDirection();
            this.currState = 'looking_around';
            this.aiMethods.setBrain();
        }
    }
    init() {
        super.init();
        const eventsObj = {
            targetReached: addEventListener('targetReached', () => {
                this.target = null;
                this.aiMethods.sit();
            }),
            aiIntentCompleted: addEventListener('aiIntentCompleted', () => {
                this.currentBehaviorState = '';
            }),
            stateChanged: addEventListener('stateChanged', () => {
                currStateText.text = `Current state: ${this._currState}`;
            }),
            behaviorChanged: addEventListener('behaviorChanged', () => {
                this.aiMethods.chooseIntent();
                aiStateText.text = `Current ai state: ${this._currentBehaviorState}`;
            })
        };
    }
}


const cat = new SmartCat();