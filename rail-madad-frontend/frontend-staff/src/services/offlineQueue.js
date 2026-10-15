import { staffClient } from '../api/staffClient';

const QUEUE_KEY = 'offline_actions_queue';
const SIMULATE_OFFLINE_KEY = 'simulate_offline_mode';

export const offlineQueue = {
  // Check if app is online (taking into account simulated offline mode)
  isOnline: () => {
    const simulatedOffline = localStorage.getItem(SIMULATE_OFFLINE_KEY) === 'true';
    if (simulatedOffline) return false;
    return typeof navigator !== 'undefined' && navigator.onLine;
  },

  // Enable/disable simulated offline mode
  setSimulatedOffline: (status) => {
    localStorage.setItem(SIMULATE_OFFLINE_KEY, String(status));
    // Trigger storage event or custom event so components can update immediately
    window.dispatchEvent(new Event('connection-state-change'));
  },

  getSimulatedOffline: () => {
    return localStorage.getItem(SIMULATE_OFFLINE_KEY) === 'true';
  },

  // Get all queued actions
  getQueue: () => {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  },

  // Add action to queue
  enqueue: (actionType, payload) => {
    const queue = offlineQueue.getQueue();
    const newAction = {
      id: `OFFLINE_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      actionType, // 'accept' | 'start' | 'resolve'
      payload,
      timestamp: new Date().toISOString()
    };
    queue.push(newAction);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Also perform local optimistic updates on tasks db so UI looks updated immediately
    offlineQueue._applyOptimisticUpdate(actionType, payload);
    
    window.dispatchEvent(new Event('offline-queue-updated'));
    return newAction;
  },

  // Sync the queue with the backend
  syncQueue: async () => {
    if (!offlineQueue.isOnline()) {
      return { success: false, reason: "Still offline" };
    }

    const queue = offlineQueue.getQueue();
    if (queue.length === 0) {
      return { success: true, count: 0 };
    }

    console.log(`Syncing ${queue.length} offline actions...`);
    const failedActions = [];

    for (const action of queue) {
      try {
        const { actionType, payload } = action;
        if (actionType === 'accept') {
          await staffClient.acceptTask(payload.taskId);
        } else if (actionType === 'start') {
          await staffClient.startTaskAction(payload.taskId);
        } else if (actionType === 'resolve') {
          await staffClient.submitResolution(
            payload.taskId,
            payload.actionTaken,
            payload.remarks,
            payload.proofImage
          );
        }
      } catch (err) {
        console.error("Failed to sync offline action:", action, err);
        // Keep failed actions in queue (or handle conflict resolution)
        failedActions.push(action);
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(failedActions));
    window.dispatchEvent(new Event('offline-queue-updated'));
    window.dispatchEvent(new Event('offline-sync-completed'));

    return {
      success: true,
      syncedCount: queue.length - failedActions.length,
      failedCount: failedActions.length
    };
  },

  // Apply optimistic updates to the local storage database so the user sees changes immediately
  _applyOptimisticUpdate: (actionType, payload) => {
    const tasks = JSON.parse(localStorage.getItem('staff_tasks') || '[]');
    const index = tasks.findIndex((t) => t.id === payload.taskId);
    if (index === -1) return;

    if (actionType === 'accept') {
      tasks[index].status = "Accepted";
      tasks[index].acceptedTime = new Date().toISOString();
    } else if (actionType === 'start') {
      tasks[index].status = "In Progress";
      tasks[index].inProgressTime = new Date().toISOString();
    } else if (actionType === 'resolve') {
      tasks[index].status = "Resolved";
      tasks[index].resolvedTime = new Date().toISOString();
      tasks[index].resolutionAction = payload.actionTaken;
      tasks[index].resolutionRemarks = payload.remarks;
      tasks[index].resolutionProof = payload.proofImage || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300";
    }

    localStorage.setItem('staff_tasks', JSON.stringify(tasks));
  }
};

// Auto-sync listener when browser comes online naturally
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    offlineQueue.syncQueue();
  });
}
