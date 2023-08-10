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

function getCardinal ({x, y}: Vector): string {
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
        speed: 1,
    },
    running: {
        speed: 15,
    },
    sitting_down: {
        postState: 'sitting',
    },
    laying_down: {
        postState: 'laying',
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
    constructor(app: Application) {
        this.app = app;
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
            const textures = [];
            loader.add(state, stateData, { crossOrigin: true });
            const resources = await loader.load(state);
            for (const texture in resources.textures) {
                textures.push(resources.textures[texture]);
            }
            this.staticTextures[state] = textures;
        }
        for (const state in spriteMap) {
            const stateObject = spriteMap[state];
            for (const direction in stateObject) {
                const textures = [];
                loader.add(`${state}_${direction}`, stateObject[direction], { crossOrigin: true });
                const resources = await loader.load(`${state}_${direction}`);
                for (const texture in resources.textures) {
                    textures.push(resources.textures[texture]);
                }
                this.texturesForAnimation[`${state}_${direction}`] = textures;
            }
        }
        return Promise.resolve();
    }
    clickListener (event: MouseEvent) {
        this.setTarget(new Vector(event.clientX, event.clientY));
        // const chanceToMove = Math.random() * 100;
        // if (chanceToMove > 99) {
        //     this.setTarget({x: event.clientX, y: event.clientY})
        //     this.currState = 'walking';
        // }
    }
    isStaticState (state: string) {
        return Object.keys(staticSprites).includes(state);
    }
    mouseMoveListener (event: MouseEvent) {
        // this.moveToPosition({
    }
    setTarget (v: Vector) {
        this.currState = 'running';
        this.target = v;
    }
    moveToPosition ({x, y}: Vector, delta: number) {
        const speed = dynamicStates[this.currState].speed || 1;
        const absX = Math.abs(x - this.catSelf.x);
        const absY = Math.abs(y - this.catSelf.y);
        if (absX <= 10 && absY <= 10) {
            this.target = null;
            dispatchEvent(this.targetReached);
            return;
        }
        const vector = new Vector(x - this.catSelf.x, y - this.catSelf.y);
        const rise = vector.y;
        const run = vector.x;
        const distance = vector.length;
        const nextX = this.catSelf.x + (run / distance) * speed * delta;
        const nextY = this.catSelf.y + (rise / distance) * speed * delta;
        this.setCatPosition(new Vector(nextX, nextY), vector.normalized);
    }
    setDefaultState () {
        this.currState = 'sitting_down';
        this.randomSouthDirection();
        this.catSelf.textures = this.texturesForAnimation[`${this.currState}_${this.currDirection}`];
        this.setSprite();
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
    setSprite () {
        if (this.isStaticState(this.currState)) {
            return;
        }
        const textures = this.texturesForAnimation[`${this.currState}_${this.currDirection}`];
        const loop = !dynamicStates[this.currState].postState;
        this.catSelf.textures = textures;
        const fps = dynamicStates[this.currState].fps || textures.length / 20;
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