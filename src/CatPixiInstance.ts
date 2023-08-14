import { AnimatedSprite, Application, Assets, BaseTexture, SCALE_MODES, Texture } from 'pixi.js';


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

type SpriteMap = Record<string, Record<string, string>>;

const spriteMap: SpriteMap = {
    walking: {
        S: './sprites/walking/walking_s.json',
        SW: './sprites/walking/walking_sw.json',
        W: './sprites/walking/walking_w.json',
        NW: './sprites/walking/walking_nw.json',
        N: './sprites/walking/walking_n.json',
        NE: './sprites/walking/walking_ne.json',
        E: './sprites/walking/walking_e.json',
        SE: './sprites/walking/walking_se.json',
    },
    running: {
        S: './sprites/running/running_s.json',
        SW: './sprites/running/running_sw.json',
        W: './sprites/running/running_w.json',
        NW: './sprites/running/running_nw.json',
        N: './sprites/running/running_n.json',
        NE: './sprites/running/running_ne.json',
        E: './sprites/running/running_e.json',
        SE: './sprites/running/running_se.json',
    },
    sitting_down: {
        S: './sprites/sitting_down/sitting_down_s.json',
        SW: './sprites/sitting_down/sitting_down_sw.json',
        W: './sprites/sitting_down/sitting_down_w.json',
        NW: './sprites/sitting_down/sitting_down_nw.json',
        N: './sprites/sitting_down/sitting_down_n.json',
        NE: './sprites/sitting_down/sitting_down_ne.json',
        E: './sprites/sitting_down/sitting_down_e.json',
        SE: './sprites/sitting_down/sitting_down_se.json',
    },
    laying_down: {
        S: './sprites/laying_down/laying_down_s.json',
        SW: './sprites/laying_down/laying_down_sw.json',
        W: './sprites/laying_down/laying_down_w.json',
        NW: './sprites/laying_down/laying_down_nw.json',
        N: './sprites/laying_down/laying_down_n.json',
        NE: './sprites/laying_down/laying_down_ne.json',
        E: './sprites/laying_down/laying_down_e.json',
        SE: './sprites/laying_down/laying_down_se.json',
    },
    looking_around: {
        S: './sprites/looking_around/looking_around_s.json',
        SW: './sprites/looking_around/looking_around_sw.json',
        W: './sprites/looking_around/looking_around_w.json',
        NW: './sprites/looking_around/looking_around_nw.json',
        N: './sprites/looking_around/looking_around_n.json',
        NE: './sprites/looking_around/looking_around_ne.json',
        E: './sprites/looking_around/looking_around_e.json',
        SE: './sprites/looking_around/looking_around_se.json',
    },
}

const playingSprite = './sprites/playing/playing.json'

const staticSprites: Record<string, string> = {
    standing: './sprites/default/standing.json',
    sitting: './sprites/default/sitting_static.json',
    laying: './sprites/default/laying_static.json',
};

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

export class Cat {
    catSelf: AnimatedSprite;
    name = 'Casper';
    app: Application;
    zoomSounds = [
        './sounds/zoom1.wav',
        './sounds/zoom2.wav'
    ]
    customFps: number = null;
    bootBlock: HTMLElement;
    currentMusic: string;
    initialSpriteTextures: Texture[] = [];
    statesList = Object.keys(spriteMap);
    defaultState = 'sitting_down';
    prevState = '';
    _currState = '';
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
    staticTextures: TextureMap = {};
    texturesForAnimation: TextureMap = {};

    currDirection: string = 'S';
    
    stateTimer: number = 0;

    target: Vector = null;

    screenCenter: Vector;
    lastClick: Vector = null;
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
        this.screenCenter = new Vector(app.screen.width / 2, app.screen.height / 2);
    }
    async loadTextures () {
        loader.add('initial', './sprites/default/standing.json');
        const resources = await Assets.load('initial');
        for (const texture in resources.textures) {
            this.initialSpriteTextures.push(resources.textures[texture]);
        }
        for (const state in staticSprites) {
            const stateData = staticSprites[state];
            loader.add(state, stateData, { crossOrigin: true });
            const resources = await loader.load(state);
            this.staticTextures[state] = Object.values(resources.textures);
        }
        for (const state in spriteMap) {
            const stateObject = spriteMap[state];
            for (const direction in stateObject) {
                loader.add(`${state}_${direction}`, stateObject[direction], { crossOrigin: true });
                const resources = await loader.load(`${state}_${direction}`);
                this.texturesForAnimation[`${state}_${direction}`] = Object.values(resources.textures);
            }
        }
        loader.add('playing', playingSprite, { crossOrigin: true });
        const playingResources = await loader.load('playing');
        this.texturesForAnimation['playing'] = Object.values(playingResources.textures);
        return Promise.resolve();
    }
    clickListener (event: MouseEvent) {}
    isStaticState (state: string) {
        return Object.keys(staticSprites).includes(state);
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
    setCatPosition ({x, y}: Vector, vector: Vector = null) {
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
        if (dynamicStates[this.currState].postState) {
            this.currState = dynamicStates[this.currState].postState;
            this.changeState();
        }
    }
    init() {
        this.catSelf = new AnimatedSprite(this.initialSpriteTextures);
        this.catSelf.onComplete = this.completeStateChange.bind(this);
        this.app.stage.addChild(this.catSelf);
        this.app.view.addEventListener('click', this.clickListener.bind(this));
        this.app.view.addEventListener('mousemove', this.mouseMoveListener.bind(this));
        this.setCatPosition(this.screenCenter);
        this.catSelf.scale.set(3);
        this.catSelf.anchor.set(0.5);
        // Listen for frame updates
        this.app.ticker.add((delta) => {
            this.stateManager(delta);
        });
    }
    destroy() {
        this.app.destroy();
    }
}