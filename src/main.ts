import { dokScreeps} from "./dokScreeps"

// import traveler
require('traveler');

// import roomvisualizer
require('visualizer')

// import screeps-profiler
const profiler = require('profiler');

// Entry point
profiler.enable();
module.exports.loop = () => {
    profiler.wrap(function() {
        dokScreeps.RunLoop();
    });
}