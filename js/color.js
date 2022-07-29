"use strict"; document.currentScript.initTime = performance.now();

class Color {
    constructor(red = 0, green = 0, blue = 0, alpha = 255, immutable = false) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
        if (immutable) {
            this.immutable = true;
            Object.freeze(this);
        }
    }

    set red(value) {
        if (this.immutable) return;
        if (value instanceof Color) this.rd = value.red;
        else this.rd = Math.round(Math.min(255, Math.max(0, value)));
        this.updateString();
    }
    set green(value) {
        if (this.immutable) return;
        if (value instanceof Color) this.gn = value.green;
        else this.gn = Math.round(Math.min(255, Math.max(0, value)));
        this.updateString();
    }
    set blue(value) {
        if (this.immutable) return;
        if (value instanceof Color) this.bl = value.blue;
        else this.bl = Math.round(Math.min(255, Math.max(0, value)));
        this.updateString();
    }
    set alpha(value) {
        if (this.immutable) return;
        if (value instanceof Color) this.al = value.alpha;
        else this.al = Math.round(Math.min(255, Math.max(0, value)));
        this.updateString();
    }
    get red() { return this.rd; }
    get green() { return this.gn; }
    get blue() { return this.bl; }
    get alpha() { return this.al; }

    set rgb(value) { this.red = value.red; this.green = value.green; this.blue = value.blue; }
    set rgba(value) { this.rgb = value; this.alpha = value.alpha; }

    setRGB(r, g, b) { this.red = r; this.green = g; this.blue = b; }
    setRGBA(r, g, b, a) { setRGB(r, g, b); this.alpha = a; }

    toString() { return this.string; }
    toStringWithAlpha(alpha = 127) { return `rgba(${this.rd}, ${this.gn}, ${this.bl}, ${alpha})`; }
    updateString() {
        if (this.al == 255) this.string = `rgb(${this.rd}, ${this.gn}, ${this.bl})`;
        else this.string = `rgba(${this.rd}, ${this.gn}, ${this.bl}, ${this.al})`;
    } //make toNumber() function

    contrastingText() {
        let brightness = Math.sqrt((Math.max(0,this.red * 1.1 - this.blue * 0.3)) ** 2 + (this.green * 1.4) ** 2 + (this.blue * 0.7) ** 2) / 448;
        if (brightness < 0.45) brightness += 0.7 - brightness * 0.6; else brightness -= 0.5;
        return new Color(brightness * 255, brightness * 255, brightness * 255);
    }

    static random(randomizeAlpha = false) {
        return new Color(Math.random() * 256, Math.random() * 256, Math.random() * 256, randomizeAlpha ? Math.random() * 256 : 255);
    }

    static randomInRange(redMin, redMax, greenMin, greenMax, blueMin, blueMax, alphaMin = 255, alphaMax = 255) {
        return new Color(Math.random() * (redMax - redMin) + redMin, Math.random() * (greenMax - greenMin) + greenMin, Math.random() * (blueMax - blueMin) + blueMin, Math.random() * (alphaMax - alphaMin) + alphaMin);
    }
}

const ALIGN_LEFT = -1;
const ALIGN_CENTER = 0;
const ALIGN_RIGHT = 1;
const ALIGN_TOP = -1;
const ALIGN_BOTTOM = 1;
const ALIGN_DEEP_BOTTOM = 2;

class DisplayText extends ObjectWithRectangle {
    //note that position designates the upper-left-hand corner of the text.  The position of the text 'caret' is near the bottom-left-hand corner, as expressed by the yOffset
    constructor(string = "", color = BLACK, alignCoordinate = new Position(), horzAlignment = ALIGN_CENTER, vertAlignment = ALIGN_CENTER, font = undefined) {
        super();
        this.string = string;
        this.color = color;
        this.ac = alignCoordinate;
        this.horzAlignment = horzAlignment;
        this.vertAlignment = vertAlignment;
        if (font !== undefined) this.font = font;

        this.lineWidth = 1;
        //this.font = font;
    }

    get string() { return this.s; }
    set string(value) { this.s = value; this.yOffset = undefined; }
    toString() { return this.string; }

    get color() { return this.clr; }
    set color(value) {
        if (value instanceof Color) {
            this.clr = value.toString();
        } else if (value === undefined) this.clr = BLACK;
        else this.clr = value;
    }

    get red() { return this.clr.red; }
    set red(value) { this.clr.red = value; }
    get green() { return this.clr.green; }
    set green(value) { this.clr.green = value; }
    get blue() { return this.clr.blue; }
    set blue(value) { this.clr.blue = value; }
    get alpha() { return this.clr.alpha; }
    set alpha(value) { this.clr.alpha = value; }
    
    get caretY() { return this.y + this.yOffset; }

    //yOffset, when undefined, also serves as the 'flag' to the draw function that the text needs to be re-aligned because the coordinate (may have) changed
    set alignCoordinate(value) { this.ac.x = value.x; this.ac.y = value.y; this.yOffset = undefined; }
    get alignCoordinate() { this.yOffset = undefined; return this.ac; }


    //These simply re-assign the align coordinate.  Context is optional.  If not provided, text will be realigned at next draw
    /*alignOverRectangle(rectangle, context = undefined) { this.alignOverRectangleCoordinates(rectangle.x, rectangle.y, rectangle.width, rectangle.height, context); }
    alignOverRectangleCoordinates(x, y, width, height, context = undefined) {
        
    }*/
    alignOverCoordinate(x, y, context = undefined) {
        this.alignCoordinate.updateFromCoordinates(x, y);
        if (context instanceof CanvasRenderingContext2D) this.realign(context);
    }
    alignOverPosition(position, context = undefined) {
        this.alignOverCoordinate(position.x, position.y, context);
    }

    //context required for this method, which actually recalcs the text position over the current center coordinate
    realign(context, doFontChange = (this.font !== undefined)) {
        let font;
        if (doFontChange) {
            font = context.font;
            context.font = this.font;
        }

        let txtMetric = context.measureText(this.string);
        this.width = txtMetric.width

        if (txtMetric.actualBoundingBoxAscent === undefined) {
            txtMetric.actualBoundingBoxAscent = 7;
        }
        if (txtMetric.actualBoundingBoxDescent === undefined) {
            txtMetric.actualBoundingBoxDescent = 0;
        }

        switch (this.horzAlignment) {
            case ALIGN_LEFT:
                this.x = this.ac.x; break;

            case ALIGN_CENTER:
                this.x = this.ac.x - this.width / 2; break;

            case ALIGN_RIGHT:
                this.x = this.ac.x - this.width; break;

            default:
                throw new Error("invalid horzAlignment!");
        }

        this.yOffset = txtMetric.actualBoundingBoxAscent;
        this.height = this.yOffset + txtMetric.actualBoundingBoxDescent;
        switch (this.vertAlignment) {
            case ALIGN_TOP:
                this.y = this.ac.y; break;

            case ALIGN_CENTER:
                this.y = this.ac.y - this.height / 2; break;

            case ALIGN_BOTTOM:
                this.y = this.ac.y - this.yOffset; break;

            case ALIGN_DEEP_BOTTOM:
                this.y = this.ac.y - this.height; break;

            default:
                throw new Error("invalid vertAlignment!");
        }

        if (doFontChange) context.font = font;
    }

    drawAt(x, y, context) {
        let oldCoordinate = this.alignCoordinate.copy();
        this.alignCoordinate.updateFromCoordinates(x, y)
        this.draw(context);
        this.alignCoordinate.updateFromPosition(oldCoordinate);
    }

    draw(context) {
        let font;
        if (this.font !== undefined) {
            font = context.font;
            context.font = this.font;
        }
        if (this.yOffset === undefined) //yOffset serves as "flag" for re-aligning
            this.realign(context, false);

        context.lineWidth = this.lineWidth;
        context.fillStyle = this.clr;
        context.fillText(this.string, this.x, this.y + this.yOffset);

        if (this.font !== undefined) context.font = font;
    }

    copy(x = this.alignCoordinate.x, y = this.alignCoordinate.y, alignCoordinate = true) {
        if (alignCoordinate)
            return new DisplayText(this.string, this.color, new Position(x, y), this.horzAlignment, this.vertAlignment);

        let copy = new DisplayText(this.string, this.color, undefined ,this.horzAlignment, this.vertAlignment);
        copy.position.updateFromCoordinates(x, y);
        copy.alignCoordinate.updateFromCoordinate(this.alignCoordinate.x + (x - this.x), this.alignCoordinate.y + (y - this.y));
        return copy;
    }
}


//template:
//const  = new Color(, , , 255, true);

//grey scale
const WHITE = new Color(255, 255, 255, 255, true);
const OFF_WHITE = new Color(224, 224, 224, 255, true);
const LIGHT_GREY = new Color(200, 200, 200, 255, true);
const GREY = new Color(128, 128, 128, 255, true);
const DARK_GREY = new Color(64, 64, 64, 255, true);
const OFF_BLACK = new Color(32, 32, 32, 255, true);
const BLACK = new Color(0, 0, 0, 255, true);


//oranges
const LIGHT_PEACH = new Color(255, 229, 204, 255, true);
const PEACH = new Color(255, 204, 153, 255, true);
const LIGHT_ORANGE = new Color(255, 178, 102, 255, true);
const ORANGE = new Color(255, 153, 51, 255, true);
const DEEP_ORANGE = new Color(255, 128, 0, 255, true);
const RUST = new Color(204, 102, 0, 255, true);
const LIGHT_BROWN = new Color(153, 76, 0, 255, true);
const BROWN = new Color(102, 51, 0, 255, true);
const DARK_BROWN = new Color(80, 40, 0, 255, true);

//reds
const LIGHT_ROSE = new Color(255, 204, 204, 255, true);
const ROSE = new Color(255, 153, 153, 255, true);
const LIGHT_RUBY = new Color(255, 102, 102, 255, true);
const LIGHT_RED = LIGHT_RUBY;
const RUBY = new Color(255, 51, 51, 255, true);
const RED = new Color(255, 0, 0, 255, true);
const DARK_RED = new Color(204, 0, 0, 255, true);
const MAROON = new Color(153, 0, 0, 255, true);
const DARK_MAROON = new Color(96, 0, 0, 255, true);

const GREEN = new Color(0, 255, 0, 255, true);
const FOREST_GREEN = new Color(0, 153, 0, 255, true);
const DARK_GREEN = new Color(0, 102, 0, 255, true);

const BLUE = new Color(0, 0, 255, 255, true);
const NAVY_BLUE = new Color(0, 0, 153, 255, true);
const DEEP_BLUE = new Color(0, 0, 102, 255, true);


const YELLOW = new Color(255, 255, 0, 255, true);
const MUSTARD = new Color(204, 204, 0, 255, true);


/*   To be continued...

const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);
const  = new Color(, , , 255, true);

*/

const BLOCK_COLOR_SCHEME = {
    standard: [
        { hits: 500, color: DARK_MAROON },
        { hits: 300, color: MAROON },
        { hits: 100, color: DEEP_BLUE },
        { hits: 50, color: BLUE },
        { hits: 25, color: DARK_GREEN },
        { hits: 10, color: MUSTARD },
        { hits: 0, color: GREEN },
    ]
}

for (let scheme in BLOCK_COLOR_SCHEME) {
    BLOCK_COLOR_SCHEME[scheme].forEach((element) => {
        element.textColor = element.color.contrastingText().toString();
        element.color = element.color.toString();
        Object.freeze(element);
    });
    Object.freeze(BLOCK_COLOR_SCHEME[scheme]);
}
Object.freeze(BLOCK_COLOR_SCHEME);

initializeLogger?.("color ran");