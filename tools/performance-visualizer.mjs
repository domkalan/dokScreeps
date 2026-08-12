import { Chart, CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, Legend } from 'chart.js';
import { Canvas } from 'skia-canvas';
import fsp from 'node:fs/promises';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// 1. Register components required for your specific chart type
Chart.register([CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, Legend]);

// 2. Parse command line arguments
const argv = yargs(hideBin(process.argv)).parse()

/**
 * Exports a grid of charts to a single image file.
 * @param {*} chartCanvases Array<{canvas: Canvas, width: number, height: number}>
 */
async function exportChart(chartCanvases) {
    // 1. Calculate the total width and height of the master canvas
    const columns = Math.ceil(Math.sqrt(chartCanvases.length));
    const rows = Math.ceil(chartCanvases.length / columns);
    const totalWidth = columns * chartCanvases[0].width;
    const totalHeight = rows * chartCanvases[0].height;

    // 2. Build the structural master canvas container
    const masterCanvas = new Canvas(totalWidth, totalHeight);
    const ctx = masterCanvas.getContext('2d');

    // 3. Fill background with a solid color (removes standard transparent canvas channel)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // 4. Loop through each individual chart canvas and draw it onto the master canvas
    for (let i = 0; i < chartCanvases.length; i++) {
        const chartWidth = chartCanvases[i].width;
        const chartHeight = chartCanvases[i].height;
        const chartCanvas = chartCanvases[i].canvas;

        const x = (i % columns) * chartWidth;
        const y = Math.floor(i / columns) * chartHeight;

        // 5. Draw each individual chart canvas onto the master canvas
        ctx.drawImage(chartCanvas, x, y, chartWidth, chartHeight);
    }

    // 6. Pipe composite file data out to disk
    const buffer = await masterCanvas.toBuffer('png');
    await fsp.writeFile(path.resolve('./data/visualizer.png'), buffer);
}

async function getJSONData() {
    // Read the JSON Lines file
    const data = await fsp.readFile(path.resolve('data/screeps_json_log.jsonl'), 'utf8');
    // Split the data into lines and parse each line as JSON
    const jsonData = data.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
    return jsonData;
}

function createLineChart(labels, data, name) {
    // 2. Initialize a backend canvas element (Width, Height)
    const canvas = new Canvas(1400, 300);

    // 3. Configure and build the Chart.js instance using the canvas context
    const chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: data.map((dataset, index) => ({
                label: dataset.label,
                data: dataset.data,
                borderColor: `hsl(${(index * 360) / data.length}, 70%, 50%)`,
                backgroundColor: `hsla(${(index * 360) / data.length}, 70%, 50%, 0.5)`,
                fill: false,
                tension: 0.1,
            }))
        },
        options: {
            devicePixelRatio: 1,
            // Add layout padding here
            layout: {
                padding: {
                    top: 20,
                    bottom: 20,
                    left: 20,
                    right: 20
                }
                // Or simply use a single number for all sides: padding: 20
            },
            plugins: {
                legend: { display: true }
            }
        }
    });

    // append title to top of canvas
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(name, canvas.width / 2, 15);

    return { canvas, width: 1400, height: 300 };
}

function createBarChart(labels, data, name) {
    // 2. Initialize a backend canvas element (Width, Height)
    const canvas = new Canvas(1400, 300);

    // 3. Configure and build the Chart.js instance using the canvas context
    const chart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: data.map((dataset, index) => ({
                label: dataset.label,
                data: dataset.data,
                backgroundColor: `hsla(${(index * 360) / data.length}, 70%, 50%, 0.5)`,
            }))
        },
        options: {
            indexAxis: 'y',
            devicePixelRatio: 1,
            // Add layout padding here
            layout: {
                padding: {
                    top: 20,
                    bottom: 20,
                    left: 20,
                    right: 20
                }
                // Or simply use a single number for all sides: padding: 20
            },
            plugins: {
                legend: { display: true, position: 'right' }
            }
        }
    });

    // append title to top of canvas
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(name, canvas.width / 2, 15);

    return { canvas, width: 1400, height: 300 };
}

function downsample(data, maxPoints = 100) {
    if (data.length <= maxPoints) {
        return data;
    }

    const bucketSize = data.length / maxPoints;
    const result = [];

    for (let i = 0; i < maxPoints; i++) {
        const start = Math.floor(i * bucketSize);
        const end = Math.floor((i + 1) * bucketSize);

        const bucket = data.slice(start, Math.max(start + 1, end));

        // Use the middle entry as the representative object.
        const representative = {
            ...bucket[Math.floor(bucket.length / 2)]
        };

        representative.tick = Math.round(
            bucket.reduce((sum, entry) => sum + entry.tick, 0) / bucket.length
        );

        representative.cpuUsage =
            bucket.reduce((sum, entry) => sum + entry.cpuUsage, 0) /
            bucket.length;

        representative.cpuBucket =
            bucket.reduce((sum, entry) => sum + entry.cpuBucket, 0) /
            bucket.length;

        representative.deltaTime =
            bucket.reduce((sum, entry) => sum + entry.deltaTime, 0) /
            bucket.length;

        result.push(representative);
    }

    return result;
}

async function main() {
    let data = await getJSONData();
    console.log(`loaded data: ${data.length} entries`);
    let labels = data.map(entry => entry.tick);

    // sometimes data comes in too big, we can average it down to a smaller size for visualization
    if (argv.maxEntries) {
        data = downsample(data, argv.maxEntries);
        labels = data.map(entry => entry.tick);
    }

    // create a chart on total CPU used
    const cpuCanvas = createLineChart(labels, [
        {
            label: 'CPU Used',
            data: data.map(entry => entry.cpuUsage),
        },
        {
            label: 'CPU Used (Rooms)',
            data: data.map(entry => entry.creepCpuUsageTotal),
        },
        {
            label: 'CPU Used (Creeps)',
            data: data.map(entry => entry.roomCPUUsageTotal),
        }
    ], 'Total CPU Usage');

    // create a chart on total CPU bucket free
    const cpuBucket = createLineChart(labels, [
        {
            label: 'CPU Bucket',
            data: data.map(entry => entry.cpuBucket),
        }
    ], 'Total CPU Bucket');

    // create a chart to log the total delta time between ticks
    const deltaTimeCanvas = createLineChart(labels, [
        {
            label: 'Tick Delta Time (ms)',
            data: data.map(entry => entry.deltaTime),
        }
    ], 'Tick Delta Time');

    // create a chart on total creeps living
    const creepCanvas = createLineChart(labels, [
        {
            label: 'All Creeps',
            data: data.map(entry => Object.values(entry.creepCounts).reduce((a, b) => a + b, 0)),
        },
        ...data[0].creepCounts ? Object.keys(data[0].creepCounts).map(role => ({
            label: `${role} Creeps`,
            data: data.map(entry => entry.creepCounts[role] || 0),
        })) : []
    ], 'Total Creeps');

    // create a chart that shows total cpu usage by creep role
    const creepCpuData = {};
    for (const entry of data) {
        const creepRoleData = {};

        for (const creep in entry.creepCPUUsage) {
            const role = creep.split('-')[0]; // assuming creep names are in the format "role-uniqueId"

            if (!creepRoleData[role]) {
                creepRoleData[role] = [];
            }

            creepRoleData[role].push(entry.creepCPUUsage[creep]);
        }

        for (const role in creepRoleData) {
            if (!creepCpuData[role]) {
                creepCpuData[role] = [];
            }

            creepCpuData[role].push(creepRoleData[role].reduce((a, b) => a + b, 0));
        }
    }

    const creepRoleCanvas = createLineChart(labels, [
        ...Object.keys(creepCpuData).map(role => ({
            label: `${role} CPU`,
            data: creepCpuData[role],
        }))
    ], 'Creep CPU Usage');

    // create a bar chart for average cpu usage by creep role
    const creepRoleAvgCpuData = {};
    for (const role in creepCpuData) {
        const totalCpu = creepCpuData[role].reduce((a, b) => a + b, 0);
        const avgCpu = totalCpu / creepCpuData[role].length;
        creepRoleAvgCpuData[role] = avgCpu;
    }

    const creepRoleAvgCanvas = createBarChart(['Average CPU'], Object.keys(creepRoleAvgCpuData).map(role => ({
        label: role,
        data: [creepRoleAvgCpuData[role]],
    })), 'Creep Role Average CPU');

    // create a chart for how the number of tasks a creep role completed in its lifetime
    const creepTaskData = {};
    const creepMinMaxValues = { min: 0, max: 0 };
    for (const entry of data) {
        for (const name in entry.creepDeaths) {
            if (!creepTaskData[name] && entry.creepDeaths[name].tasks > 10) {
                creepMinMaxValues.min = Math.min(creepMinMaxValues.min, entry.creepDeaths[name].tasks);
                creepMinMaxValues.max = Math.max(creepMinMaxValues.max, entry.creepDeaths[name].tasks);

                creepTaskData[name] = entry.creepDeaths[name].tasks || 0;
            }
        }
    }

    const creepTaskCanvas = createBarChart(['Tasks Completed'], creepTaskData ? Object.keys(creepTaskData).map(name => ({
        label: name,
        data: [creepTaskData[name] || 0],
    })) : [], 'Creep Tasks Completed (Lifetime)');

    // create a chart for cpu usage by room
    const roomCpuData = {};
    for (const entry of data) {
        for (const roomName in entry.roomCPUUsage) {
            if (!roomCpuData[roomName]) {
                roomCpuData[roomName] = [];
            }

            roomCpuData[roomName].push(entry.roomCPUUsage[roomName]);
        }
    }

    const roomCpuCanvas = createLineChart(labels, [
        ...Object.keys(roomCpuData).map(roomName => ({
            label: `${roomName} CPU`,
            data: roomCpuData[roomName],
        }))
    ], 'Room CPU Usage');

    // create a chart for each rooms stored energy
    const roomEnergyData = {};
    for (const entry of data) {
        for (const roomName in entry.roomEnergyStored) {
            if (!roomEnergyData[roomName]) {
                roomEnergyData[roomName] = [];
            }

            roomEnergyData[roomName].push(entry.roomEnergyStored[roomName]);
        }
    }

    const roomEnergyCanvas = createLineChart(labels, [
        ...Object.keys(roomEnergyData).map(roomName => ({
            label: `${roomName} Energy`,
            data: roomEnergyData[roomName],
        }))
    ], 'Room Energy Stored');

    // create a chart to monitor room spawn energy usage
    const roomSpawnEnergyData = {};
    for (const entry of data) {
        for (const roomName in entry.roomSpawnEnergyStored) {
            if (!roomSpawnEnergyData[roomName]) {
                roomSpawnEnergyData[roomName] = [];
            }

            roomSpawnEnergyData[roomName].push(entry.roomSpawnEnergyStored[roomName]);
        }
    }

    const roomSpawnEnergyCanvas = createLineChart(labels, [
        ...Object.keys(roomSpawnEnergyData).map(roomName => ({
            label: `${roomName} Spawn Energy`,
            data: roomSpawnEnergyData[roomName],
        }))
    ], 'Room Spawn Energy');

    // export the charts to a single image file
    await exportChart([cpuCanvas, cpuBucket, deltaTimeCanvas, roomCpuCanvas, roomEnergyCanvas, roomSpawnEnergyCanvas, creepCanvas, creepRoleCanvas, creepTaskCanvas, creepRoleAvgCanvas]);
}

// 3. Call the main function to execute the script
main();