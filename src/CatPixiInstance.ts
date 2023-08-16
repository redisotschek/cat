import { AnimatedSprite, Application, Assets, BaseTexture, SCALE_MODES, Texture } from 'pixi.js';
import { text } from 'stream/consumers';

function splitArrayIntoChunks(arr: Array<Texture>, chunkSize: number) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

const CARDINAL_DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];

export class Vector {
    x: number;
    y: number;
    constructor (x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
    }
    get length () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    get normalized () {
        return new Vector(this.x / this.length, this.y / this.length);
    }
}

type TextureMap = Record<string, Texture[]>;

type AnimationsMap = Record<string, Texture[]>;

export function getCardinal ({x, y}: Vector): string {
    const meausurementError = 0.1;
    let direction = '';
    if (y != 0 && Math.abs(y) > meausurementError) {
        direction += y < 0 ? 'N' : 'S';
    }
    if (x != 0 && Math.abs(x) > meausurementError) {
        direction += x < 0 ? 'W' : 'E';
    }
    return direction;
}

type DynamicState = {
    speed?: number;
    postState?: string;
    fps?: number;
}

const dynamicStates: Record<string, DynamicState> = {
    walking: {
        speed: 3,
        fps: 0.1,
    },
    running: {
        speed: 10,
    },
    sitting_down: {
        postState: 'sitting',
    },
    laying_down: {
        postState: 'laying',
    },
    playing: {
        fps: 0.1,
    },
    looking_around: {
        postState: 'sitting',
        fps: 0.1,
    }
};

BaseTexture.defaultOptions.scaleMode = SCALE_MODES.NEAREST;

const loader = Assets;

const spritesUrl = 'sprites/cat_animations.json';

export class Cat {
    catSelf: AnimatedSprite;
    name = 'Casper';
    app: Application;
    zoomSounds = [
        './sounds/zoom1.wav',
        './sounds/zoom2.wav'
    ]
    customFps: number | null;
    bootBlock: HTMLElement;
    defaultState = 'sitting_down';
    staticStates = ['sitting', 'laying'];
    staticSprites: TextureMap = {};
    prevState = '';
    _currState: string = '';
    set currState(state) {
        this._currState = state;
        this.stateTimer = 0;
        dispatchEvent(this.stateChanged);
    }
    get currState() {
        return this._currState;
    }
    targetReached = new Event('targetReached');
    stateChanged = new Event('stateChanged');
    texturesForAnimation: TextureMap = {};

    currDirection: string = 'S';
    
    stateTimer: number = 0;

    target: Vector | null = null;

    screenCenter: Vector;
    lastClick: Vector | null = null;
    constructor(app: Application, bootBlock: HTMLElement) {
        this.app = app;
        if (!app) {
            throw new Error('App is required, please make sure you provide the constructor with a PIXI Application instance');
            return;
        }
        if (!bootBlock) {
            throw new Error('Document is required, please make sure you are using this module in a browser');
            return;
        }
        this.bootBlock = bootBlock;
        this.screenCenter = new Vector(this.app.screen.width / 2, this.app.screen.height / 2);
    }
    async loadTextures () {
        loader.add('animations', spritesUrl, { crossOrigin: true });
        const allAnimations: AnimationsMap = (await Assets.load('animations')).animations;
        const {playing, ...animations} = allAnimations;
        this.texturesForAnimation['playing'] = playing;
        for (const [key,  value] of Object.entries(animations)) {
            const textures = splitArrayIntoChunks(value, value.length / CARDINAL_DIRECTIONS.length);
            for (const i in textures) {
                this.texturesForAnimation[`${key}_${CARDINAL_DIRECTIONS[i]}`] = textures[i];
                const staticState = key.split('_')[0];
                if (!this.staticSprites[staticState]) {
                    this.staticSprites[staticState] = [];
                }
                this.staticSprites[staticState].push(textures[i][textures[i].length - 1]); //get last element of textures
            }
        }
        return Promise.resolve();
    }
    clickListener (event: MouseEvent) {}
    isStaticState (state: string) {
        return this.staticStates.includes(state);
    }
    mouseMoveListener (event: MouseEvent) {}
    setTarget (v: Vector, movementMode: 'walking' | 'running' = 'walking') {
        this.currState = movementMode;
        this.target = v;
    }
    isTargetReached({x, y}: Vector): boolean {
        const absX = Math.abs(x - this.catSelf.x);
        const absY = Math.abs(y - this.catSelf.y);
        return absX <= 10 && absY <= 10;
    }
    moveToPosition (position: Vector, delta: number) {
        const speed = dynamicStates[this.currState].speed || 1;
        const vector = new Vector(position.x - this.catSelf.x, position.y - this.catSelf.y);
        const rise = vector.y;
        const run = vector.x;
        const distance = vector.length;
        const nextX = this.catSelf.x + (run / distance) * speed * delta;
        const nextY = this.catSelf.y + (rise / distance) * speed * delta;
        if (this.isTargetReached(position)) {
            this.target = null;
            dispatchEvent(this.targetReached);
        }
        this.setCatPosition(new Vector(nextX, nextY), vector.normalized);
        return;
    }
    setCatPosition ({x, y}: Vector, vector: Vector | null = null) {
        // move the sprite to the center of the screen
        if (vector) {
            const direction = getCardinal(vector);
            if (direction !== this.currDirection) {
                this.currDirection = direction;
                this.setSprite();
            }
        }
        this.catSelf.x = x;
        this.catSelf.y = y;
    }
    setDefaultState () {
        this.currState = 'sitting_down';
        this.randomSouthDirection();
        this.catSelf.textures = this.texturesForAnimation[`${this.currState}_${this.currDirection}`];
        this.setSprite();
    }
    setSprite () {
        if (this.isStaticState(this.currState)) {
            let textures = this.staticSprites[this.currState];
            let index = CARDINAL_DIRECTIONS.findIndex(dir => dir === this.currDirection);
            this.catSelf.textures = textures;
            this.catSelf.gotoAndStop(index);
            return;
        }
        let textures = this.texturesForAnimation[`${this.currState}_${this.currDirection}`];
        if (!textures) {
            textures = this.texturesForAnimation[`${this.currState}`];
        }
        const loop = !dynamicStates[this.currState].postState;
        this.catSelf.textures = textures;
        let fps = dynamicStates[this.currState].fps || textures.length / 20;
        if (this.customFps) {
            fps = this.customFps;
            this.customFps = null;
        }
        this.catSelf.animationSpeed = fps;
        this.catSelf.loop = loop;
        this.catSelf.play();
    }
    stateManager(delta: number) {
        if (!this.currState) {
            this.currState = this.defaultState;
        }
        const newState = this.currState !== this.prevState;
        if (newState) {
            this.prevState = this.currState;
            this.changeState();
        }
        this.stateTimer += delta;
        if (Object.keys(dynamicStates).includes(this.currState) && this.target) {
            return this.moveToPosition(this.target, delta);
        }
    }
    randomSouthDirection () {
        const x = Math.floor(Math.random() * 3) - 1;
        this.currDirection = getCardinal(new Vector(x, 1));
    }
    changeState () {
        if (this.currState === this.defaultState) {
            this.setDefaultState();
        }
        this.setSprite();
    }
    
    completeStateChange () {
        if (dynamicStates[this.currState] && dynamicStates[this.currState].postState) {
            const postState = dynamicStates[this.currState].postState;
            if (postState) {
                this.currState = postState;
                this.changeState();
            }
        }
    }
    init() {
        this.catSelf = new AnimatedSprite(this.texturesForAnimation[`${this.defaultState}_${this.currDirection}`]);
        this.catSelf.onComplete = this.completeStateChange.bind(this);
        this.app.stage.addChild(this.catSelf);
        this.setCatPosition(this.screenCenter);
        this.catSelf.scale.set(3);
        this.catSelf.anchor.set(0.5);
        // @ts-ignore
        this.app.view.addEventListener('click', this.clickListener.bind(this));
        // @ts-ignore
        this.app.view.addEventListener('mousemove', this.mouseMoveListener.bind(this));
        // Listen for frame updates
        this.app.ticker.add((delta) => {
            this.stateManager(delta);
        });
    }
    destroy() {
        this.app.destroy();
    }
}