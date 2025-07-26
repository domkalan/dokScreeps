import { dokScreeps} from "./dokScreeps"
import { ObjectPool } from "./ObjectPool";

// import traveler
require('traveler');

// import roomvisualizer
require('visualizer')

// import screeps-profiler
const profiler = require('profiler');

// Entry point
profiler.enable();
module.exports.loop = () => {
    ObjectPool.resetPool();

    profiler.wrap(function() {
        dokScreeps.RunLoop();
    });
}