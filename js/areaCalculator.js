(function() {

var stage = new PIXI.Stage(0x66FF99);
var renderer = PIXI.autoDetectRenderer(640, 480);
var globalDrawing = new PIXI.Graphics();
stage.addChild(globalDrawing);

function View() {
    var id = getUniqueId();

    this.getId = function() {
        return id;
    };

    // interface
    this.update = function() {};
    this.draw = function() {};
    this.toJSON = function() {};
}

Inherit(Edge, View);
function Edge(vertex1, vertex2) {
    var self = this;
    this.vertex1 = vertex1;
    this.vertex2 = vertex2;

    var text = new PIXI.Text("Test", { font: "20pt monospace", fill: "gray" });
    stage.addChild(text);

    Object.defineProperty(this, 'length', {
        get: function() {
            var diffX = this.vertex1.x - this.vertex2.x;
            var diffY = this.vertex1.y - this.vertex2.y;

            return Math.round(Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2)));
        },
        enumerable: true,
        configurable: true
    });

    this.getOtherVertex = function(vertex) {
        function checkEmpty(vertex) {
            if (vertex) {
                return vertex;
            }
        }

        if (this.vertex1 === vertex) {
            return checkEmpty(this.vertex2);
        }
        return checkEmpty(this.vertex1);
    };

    function getMiddleCoordinates() {
        var diffX = self.vertex1.x - self.vertex2.x;
        var diffY = self.vertex1.y - self.vertex2.y;

        return {
            x: self[(self.vertex2.x > self.vertex1.x) ? 'vertex1': 'vertex2'].x + Math.abs(diffX) / 2,
            y: self[(self.vertex2.y > self.vertex1.y) ? 'vertex1': 'vertex2'].y + Math.abs(diffY) / 2
        };
    }

    this.update = function() {
       text.position = getMiddleCoordinates();
    };

    this.draw = function() {
        globalDrawing.lineStyle(1, 0x0000FF, 1);
        globalDrawing.beginFill(0x0000FF);
        globalDrawing.moveTo(this.vertex1.x, this.vertex1.y);
        globalDrawing.lineTo(this.vertex2.x, this.vertex2.y);
        globalDrawing.endFill();

        text.setText(this.length);
    }

    this.toJSON = function() {
        return {
            id1: this.vertex1.getId(),
            id2: this.vertex2.getId()
        }
    };
}

Inherit(Vertex, View);
function Vertex(x, y, graph) {
    var self = this;
    var x = x;
    var y = y;

    Object.defineProperty(this, 'x', {
        get: function() { return x; },
        set: function(val) {
            graph.onVertexUpdate();
            x = val;
        }
    });

    Object.defineProperty(this, 'y', {
        get: function() { return y; },
        set: function(val) {
            graph.onVertexUpdate();
            y = val;
        }
    });

    this.edges = [];

    this.highlighted = false;
    this.active = false;
    var radius = 10;

    var touchHotspot = new PIXI.Circle(x, y, radius);
    var vertexContainer = new PIXI.Graphics();
    vertexContainer.__behavior = this;
    vertexContainer.hitArea = touchHotspot;  
    vertexContainer.interactive = true;  
    stage.addChild(vertexContainer);

    vertexContainer.mouseover = function(e) {
        self.highlighted = true;
    };

    vertexContainer.mouseout = function(e) {
        self.highlighted = false;
    };

    this.update = function() {
        vertexContainer.clear();
    };

    this.draw = function() {
        touchHotspot.x = x;
        touchHotspot.y = y;

        vertexContainer.beginFill(0x999999);
        if (this.highlighted) {
            vertexContainer.beginFill(0x333333);
        }
        if (this.active) {
            vertexContainer.beginFill(0xffff00);
        }

        vertexContainer.drawCircle(x, y, radius);
        vertexContainer.endFill();
    };

    this.contains = function(x, y) {
        return vertexContainer.hitArea.contains(x, y);
    };

    this.getOtherEdge = function(edge) {
        function checkEmpty(edge) {
            if (edge) {
                return edge;
            }
        }

        if (edge === this.edges[0]) {
            return checkEmpty(this.edges[1]);
        }
        return checkEmpty(this.edges[0]);
    };

    this.toJSON = function() {
        return {
            id : this.getId(),
            x  : x,
            y  : y
        };
    };
}

Inherit(Graph, View);
function Graph() {
    var self = this;
    var vertexList = [];
    var edgeList   = [];
    var middleText = '';

    var center;
    var area;
    var isCyclic = false;

    var polygon;
    var _activeVertex;
    Object.defineProperty(this, 'activeVertex', {
        get: function() { return _activeVertex; },
        set: function(vertex) {
            if (_activeVertex) {
                _activeVertex.active = false;
            }
            _activeVertex = vertex;
            if (_activeVertex) {
                _activeVertex.active = true;
            }
        },
        enumerable: true,
        configurable: true
    });

    this.addEdge = function(edge) {
        edge.vertex1.edges.push(edge);
        edge.vertex2.edges.push(edge);

        edgeList.push(edge);

        if (this.isCyclic()) {
            isCyclic = true;
            // compute area and center
            area = this.shoelace();
            center = this.centroid();
        }

        return edge.id;
    };

    this.addVertex = function(vertex) {
        if (self.activeVertex) {
            var edge = new Edge(self.activeVertex, vertex);
            self.addEdge(edge);
        }

        self.activeVertex = vertex;
        vertexList.push(vertex);

        return vertex.id;
    };

    this.getVertex = function(x, y) {
        var currentVertex;
        vertexList.some(function(vertex) {
            if (vertex.contains(x, y)) {
                currentVertex = vertex;
                return;
            }
        });
        return currentVertex;
    };

    this.isCyclic = function() {
        if (!vertexList.length || !edgeList.length) return false;

        var result = false;
        var currVertex = vertexList[0];
        var currEdge = vertexList[0].edges[0];
        do {
            currVertex = currEdge.getOtherVertex(currVertex);
            currEdge = currVertex.getOtherEdge(currEdge);
            result = currVertex === vertexList[0];
        } while (currVertex && currEdge && currVertex !== vertexList[0]);
        return result;
    };

    this.shoelace = function() {
        if (!this.isCyclic()) return;

        var plusArea  = 0;
        var minusArea = 0;

        var currVertex = vertexList[0];
        var currEdge   = vertexList[0].edges[0];
        var prevX;
        var prevY;
        do {
            if (prevX) {
                plusArea += prevX * currVertex.y;
            }
            if (prevY) {
                minusArea += prevY * currVertex.x;
            }
            prevX = currVertex.x;
            prevY = currVertex.y; 

            currVertex = currEdge.getOtherVertex(currVertex);
            currEdge = currVertex.getOtherEdge(currEdge);           
        } while (currVertex !== vertexList[0]);

        var firstVertex = vertexList[0];
        var lastVertex  = vertexList[vertexList.length - 1];
        plusArea  += lastVertex.x * firstVertex.y;
        minusArea += lastVertex.y * firstVertex.x;

        var area = 0.5 * Math.abs(plusArea - minusArea);

        return Math.round(area / 100);
    };

    this.centroid = function() {
        var pts = vertexList;

        var twicearea=0,
        x=0, y=0,
        nPts = pts.length,
        p1, p2, f;
        for ( var i=0, j=nPts-1 ; i<nPts ; j=i++ ) {
            p1 = vertexList[i]; p2 = vertexList[j];
            f = p1.x*p2.y - p2.x*p1.y;
            twicearea += f;
            x += ( p1.x + p2.x ) * f;
            y += ( p1.y + p2.y ) * f;
        }
        f = twicearea * 3;

        return { x: x/f, y: y/f };
    }

    // vertex calls this when its coordiantes change
    this.onVertexUpdate = function() {
        if (isCyclic) {
            area = this.shoelace();
            center = this.centroid();
        }
    };

    this.update = function() {
        edgeList.forEach(function(edge) {
            edge.update();
        });
        var points = [];
        vertexList.forEach(function(vertex) {
            points.push(PIXI.Point(vertex.x, vertex.y));
            vertex.update();
        });
        polygon = PIXI.Polygon(points);
    };

    this.draw = function() {
        edgeList.forEach(function(edge) {
            edge.draw();
        });
        vertexList.forEach(function(vertex) {
            vertex.draw();
        });

        var vertexContainer = new PIXI.Graphics();
        vertexContainer.__behavior = this;
        //vertexContainer.hitArea = touchHotspot;
        vertexContainer.interactive = true;
        stage.addChild(vertexContainer);
    };

    this.getArea = function() {
        return area;
    }

    this.getCenter = function() {
        return center;
    }

    this.toJSON = function() {
        var json = { vertexes: [], edges: [], area: area, center: center };
        vertexList.forEach(function(vertex) {
            json.vertexes.push(vertex.toJSON());
        });
        edgeList.forEach(function(edge) {
            json.edges.push(edge.toJSON());
        });
        return json;
    };
}

function GraphInteractionManager(graph, stage) {
    var self = this;
    var center = null;
    var isDragging = false;

    stage.mouseup = function(e) {
        isDragging = false;
        graph._draggingVertex = undefined;
    };

    stage.mousemove = function(e) {
        if (isDragging) {
            var vertex = graph._draggingVertex || graph.getVertex(e.global.x, e.global.y);
            if (vertex) {
                graph._draggingVertex = vertex;
                isDragging = true;
                vertex.x = e.global.x;
                vertex.y = e.global.y;
            }
        }
    };

    stage.mousedown = function(e) {
        isDragging = true;
    };

    stage.click = function(e) {
        var oldVertex = graph.getVertex(e.global.x, e.global.y);
        if (oldVertex) {
            if (oldVertex.edges.length < 2) {
                if (graph.activeVertex === oldVertex) {
                    graph.activeVertex = undefined;
                } else {
                    var edge = new Edge(graph.activeVertex, oldVertex);
                    graph.addEdge(edge);
                    graph.activeVertex = undefined;
                }
            }
        } else if (!graph.isCyclic()) {
            var newVertex = new Vertex(e.global.x, e.global.y, graph);
            graph.addVertex(newVertex);
            graph.activeVertex = newVertex;
        }
    };
}

Inherit(GraphInterface, View);
function GraphInterface(graph) {
    var self = this;
    var middleText = new PIXI.Text('', { font: "20pt monospace", fill: "red" });
    stage.addChild(middleText);

    this.update = function() {
        graph.update();
    };

    this.draw = function() {
        graph.draw();
        if (graph.getArea()) {
            middleText.setText(graph.getArea());
            middleText.position = graph.getCenter();
        }
    };
}

// add the renderer view element to the DOM
document.body.appendChild(renderer.view);

function AreaCalculator() {
    var self = this;
    var graph;
    var graphInterface;
    var graphInteractionManager;

    this.init = function() {
        graph = new Graph();
        graphInterface = new GraphInterface(graph);
        graphInteractionManager = new GraphInteractionManager(graph, stage);
    };

    this.render = function() {
        // render the stage
        globalDrawing.clear();
        graphInterface.update();
        graphInterface.draw();
        renderer.render(stage);

        requestAnimationFrame(self.render);
    };
}

var areaCalculator = new AreaCalculator();
areaCalculator.init();
var id = requestAnimationFrame(areaCalculator.render);

var uniqueCounter = 0;
function getUniqueId() {
    return uniqueCounter++;
}

// http://www.jspatterns.com/classical-inheritance/
 function Inherit(C, P) {
    // Clone P, but with an empty ctor, so we don't have to execute it when just defining a class.
    var F = function() {};
    F.prototype = P.prototype;
    // Set C's prototype to an uninitialized instance of P.
    C.prototype = new F();
    // Add a convenience property for getting to P's methods. Use CurrentClass.uber.myMethod.call(this, foo, bar).
    C.uber = P.prototype;
    // Reset constructor, so instanceof doesn't show that instances of C are instances of P.
    C.prototype.constructor = C;
};

}());