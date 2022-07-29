"use strict"; document.currentScript.initTime = performance.now();

class LineCache extends Line { //cache of all surfaces on a given line (with slope/invSlope and intercepts)
    static rebuildCaches(engine) {
        LineCache.engine = engine;
        LineCache.vertCaches = new Array();
        LineCache.horzCaches = new Array();
        LineCache.angledCaches = new Array();
        LineCache.edges = new Array();

        engine.surfaces.forEach((surface) => {
            LineCache.addToCache(surface);
        });
    }

    static addToCache(surface) {
        surface.recalc();
        if (surface.point1.equalTo(surface.point2)) throw new Error("surface points are both the same!");

        //vertical lines
        else if (surface.point1.x === surface.point2.x) {
            let i = 0;
            while (i < LineCache.vertCaches.length && surface.point1.x > LineCache.vertCaches[i].xIntercept) { i++; }
            if (i === LineCache.vertCaches.length || LineCache.vertCaches[i].xIntercept !== surface.point1.x) { //create new cache
                LineCache.vertCaches.splice(i, 0, new LineCache(surface));
                LineCache.vertCaches[i].array = LineCache.vertCaches;
                LineCache.vertCaches[i].grouping = "vert";
            } else if (LineCache.vertCaches[i].xIntercept === surface.point1.x) { //add to an already-existing cache
                LineCache.vertCaches[i].addSurface(surface);
            } else throw new Error("LineCache array sorting not working correctly");
            surface.lineCache = LineCache.vertCaches[i];

        //horizontal lines
        } else if (surface.point1.y === surface.point2.y) {
            let i = 0;
            while (i < LineCache.horzCaches.length && surface.point1.y > LineCache.horzCaches[i].yIntercept) { i++; }
            if (i === LineCache.horzCaches.length || LineCache.horzCaches[i].yIntercept !== surface.point1.y) { //create new cache
                LineCache.horzCaches.splice(i, 0, new LineCache(surface));
                LineCache.horzCaches[i].array = LineCache.horzCaches;
                LineCache.horzCaches[i].grouping = "horz";
            } else if (LineCache.horzCaches[i].yIntercept === surface.point1.y) { //add to an already-existing cache
                LineCache.horzCaches[i].addSurface(surface);
            } else throw new Error("LineCache array sorting not working correctly");
            surface.lineCache = LineCache.horzCaches[i];

        //angled lines are grouped into sub-arrays ordered by slope, then ordered by axis-intercept of primary coordinate within each sub-array 
        } else {
            let i = 0;
            while (i < LineCache.angledCaches.length && surface.slope > LineCache.angledCaches[i].slope) { i++; }

            if (i === LineCache.angledCaches.length || LineCache.angledCaches[i].slope !== surface.slope) { //create new sub-array of caches
                LineCache.angledCaches.splice(i, 0, [new LineCache(surface)]);
                LineCache.angledCaches[i][0].array = LineCache.angledCaches[i];
                LineCache.angledCaches[i][0].angled = true;
                LineCache.angledCaches[i].slope = surface.slope;
                LineCache.angledCaches[i].invSlope = surface.invSlope;
                Line.assignPrimarySecondaryCoordinatesSlopesIntercepts(LineCache.angledCaches[i]);
                LineCache.angledCaches[i].primaryInterceptIncreasing_vectorAngleRange = Line.primaryInterceptIncreasing_vectorAngleRange(LineCache.angledCaches[i]);
                surface.lineCache = LineCache.angledCaches[i][0];
            } else if (LineCache.angledCaches[i].slope === surface.slope) { //find the matching cache within the subarray, or create a new one
                let primaryIntercept = LineCache.angledCaches[i].primaryIntercept;
                let intercept = primaryIntercept(surface);
                let j = 0;
                while (j < LineCache.angledCaches[i].length && intercept > primaryIntercept(LineCache.angledCaches[i][j])) { j++; }
                if (j === LineCache.angledCaches[i].length || primaryIntercept(LineCache.angledCaches[i][j]) !== intercept) { //create new cache
                    LineCache.angledCaches[i].splice(j, 0, new LineCache(surface));
                    LineCache.angledCaches[i][j].array = LineCache.angledCaches[i];
                    LineCache.angledCaches[i][j].angled = true;
                } else if (primaryIntercept(LineCache.angledCaches[i][j]) === intercept) { //add to an already-existing cache
                    LineCache.angledCaches[i][j].addSurface(surface);
                } else throw new Error("LineCache array sorting not working correctly");
                surface.lineCache = LineCache.angledCaches[i][j];
            } else throw new Error("LineCache array sorting not working correctly");
        }
        if (LineCache.engine.edges.indexOf(surface) >= 0) {
            LineCache.edges.push(surface.lineCache);
            surface.lineCache.edge = true;
        }
    }

    constructor(seedSurface) {
        super(seedSurface.point1, seedSurface.point2)
        this.cache = [seedSurface];
    }

    addSurface(surface) {
        let i = 0;
        let surfacePrimaryCoordinate = Math.min(this.primaryCoordinate(surface.point1), this.primaryCoordinate(surface.point2));
        while (i < this.cache.length && (this.primaryCoordinate(this.cache[i].point1) <= surfacePrimaryCoordinate || this.primaryCoordinate(this.cache[i].point2) <= surfacePrimaryCoordinate)) { i++; }
        this.cache.splice(i, 0, surface);
    }

    getSurfacesAt(intersectionPoint) {
        let i = 0;
        let result = new Array();
        let coordinate = this.primaryCoordinate(intersectionPoint);
        while (i < this.cache.length && this.primaryCoordinate(this.cache[i].point1) < coordinate && this.primaryCoordinate(this.cache[i].point2) < coordinate) { i++; }
        while (i < this.cache.length && !(this.primaryCoordinate(this.cache[i].point1) > coordinate && this.primaryCoordinate(this.cache[i].point2) > coordinate)) {
            if ((this.primaryCoordinate(this.cache[i].point1) <= coordinate && this.primaryCoordinate(this.cache[i].point2) >= coordinate) ||
                (this.primaryCoordinate(this.cache[i].point1) >= coordinate && this.primaryCoordinate(this.cache[i].point2) <= coordinate))
                result.push(this.cache[i]);
            i++;
        }
        if (result.length > 0) return result; else return undefined;
    }

    static getAllSurfacesAt(point) {
        let currentArray = undefined;
        let result = new Array();
        for (let a = -2; a < LineCache.angledCaches.length; a++) {
            if (a < 0) currentArray = (a === -2 ? LineCache.vertCaches : LineCache.horzCaches)
            else currentArray = LineCache.angledCaches[a];
            for (let c = 0; c < currentArray.length; c++) {
                if (currentArray[c].containsPoint(point)){
                    var temp = currentArray[c].getSurfacesAt(point);
                    if (temp) result.push(...temp);
                }
            }
        }
        if (result.length > 0) return result; else return undefined;
    }

    static destroy(surfaces) {
        surfaces.forEach((surface) => {
            surface.destroyed = true;
            surface.lineCache.remove(surface)
        });
    }

    remove(surface) {
        this.cache.splice(surface.lineCache.cache.indexOf(surface), 1);
        if (this.cache.length === 0) LineCache.removeLine(this);
    }

    static removeLine(lineCache) {
        let index = lineCache.array.indexOf(lineCache);
        lineCache.array.splice(index, 1);

        if (lineCache.angled) {
            let subArrayIndex = LineCache.angledCaches.indexOf(lineCache.array);
            IntersectionsCache.removeAngledLine(subArrayIndex, index);
            if (lineCache.array.length === 0) {
                LineCache.angledCaches.splice(subArrayIndex, 1);
                IntersectionsCache.removeAngledSubArray(subArrayIndex);
            }
        } else {
            IntersectionsCache.removeHorzVertLine(lineCache.grouping, index);
        }
    }
}


class IntersectionsCache {
    static rebuildCaches(engine) {
        IntersectionsCache.engine = engine;
        let balls = engine.board.balls;
        IntersectionsCache.caches = new Array(balls.length);
        IntersectionsCache.edges = new Array();
        for (let i = 0; i < balls.length; i++) {
            IntersectionsCache.caches[i] = new IntersectionsCache(balls[i], i);
        }
    }

    constructor(ball, index) {
        this.ball = ball;
        this.index = index;
        ball.intersectionsCache = this;
        ball.collisionSurfaces = new Array();
        this.vertIntersections = new Array(LineCache.vertCaches.length);
        this.horzIntersections = new Array(LineCache.horzCaches.length);
        this.angledIntersections = new Array(LineCache.angledCaches.length);
        for (let i = 0; i < LineCache.vertCaches.length; i++) {
            this.vertIntersections[i] = new Intersection(ball, LineCache.vertCaches[i], false);
            this.vertIntersections[i].recalc = true;
        }
        for (let i = 0; i < LineCache.horzCaches.length; i++) {
            this.horzIntersections[i] = new Intersection(ball, LineCache.horzCaches[i], false);
            this.horzIntersections[i].recalc = true;
        }
        for (let i = 0; i < LineCache.angledCaches.length; i++) {
            this.angledIntersections[i] = new Array(LineCache.angledCaches[i].length);
            for (let j = 0; j < LineCache.angledCaches[i].length; j++) {
                this.angledIntersections[i][j] = new Intersection(ball, LineCache.angledCaches[i][j], false);
                this.angledIntersections[i][j].recalc = true;
            }
        }
    }

    getEdgeIntersections() {
        if (this.edges) return this.edges;
        this.edges = new Array();
        IntersectionsCache.engine.edges.forEach((edge) => {
            this.edges.push(new Intersection(this.ball, edge, false));
        });
        return this.edges;
    }

    static removeHorzVertLine(grouping, index) {
        grouping += "Intersections"
        IntersectionsCache.caches.forEach((cache) => {
            cache[grouping].splice(index, 1);
        });
    }

    static removeAngledLine(subArrayIndex, index) {
        IntersectionsCache.caches.forEach((cache) => {
            cache.angledIntersections[subArrayIndex].splice(index, 1);
        });
    }

    static removeAngledSubArray(subArrayIndex) {
        IntersectionsCache.caches.forEach((cache) => {
            cache.angledIntersections.splice(subArrayIndex, 1);
        });
    }
}

initializeLogger?.("engine.caches ran");