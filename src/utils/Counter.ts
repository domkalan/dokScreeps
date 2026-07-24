export function getRoleNameCounter(roleName: string): number {
    if (!Memory.counter) {
        Memory.counter = {};
    }

    const counterKey = `roleNameCounter_${roleName}`;
    if (!Memory.counter[counterKey]) {
        Memory.counter[counterKey] = 0;
    }

    const counterValue = Memory.counter[counterKey];
    Memory.counter[counterKey] += 1; // Increment the counter for the next call

    if (roleName === 'queen' && counterValue > 10) {
        Memory.counter[counterKey] = 0; // Reset the counter if it exceeds 10 for queens
    }

    if (counterValue > 100) {
        Memory.counter[counterKey] = 0; // Reset the counter if it exceeds 20
    }

    return counterValue;
}