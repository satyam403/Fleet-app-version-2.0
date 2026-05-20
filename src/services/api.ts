// Mock data storage using localStorage with initial seed data
import type { 
  Trailer, 
  Inspection, 
  InventoryItem, 
  WorkOrder, 
  DashboardStats 
} from '../types';

// Storage keys
const STORAGE_KEYS = {
  trailers: 'fleetops-trailers',
  inspections: 'fleetops-inspections',
  inventory: 'fleetops-inventory',
  workOrders: 'fleetops-workOrders',
  users: 'fleetops-users',
};

// Initialize with seed data if not exists
function initializeStorage() {
  // Initialize demo users
  if (!localStorage.getItem(STORAGE_KEYS.users)) {
    const demoUsers = [
      {
        id: '1',
        name: 'Admin User',
        email: 'admin@fleetops.com',
        password: 'admin123',
        role: 'admin',
      },
      {
        id: '2',
        name: 'Technician User',
        email: 'tech@fleetops.com',
        password: 'tech123',
        role: 'technician',
      },
    ];
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(demoUsers));
  }


  if (!localStorage.getItem(STORAGE_KEYS.inspections)) {
    localStorage.setItem(STORAGE_KEYS.inspections, JSON.stringify([]));
  }

  
}

// Generic storage functions
function getFromStorage<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Trailers
export async function getTrailers(): Promise<Trailer[]> {
  initializeStorage();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getFromStorage<Trailer>(STORAGE_KEYS.trailers));
    }, 300);
  });
}

// Inspections
export async function getInspections(): Promise<Inspection[]> {
  initializeStorage();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getFromStorage<Inspection>(STORAGE_KEYS.inspections));
    }, 300);
  });
}

export async function createInspection(inspection: Omit<Inspection, 'id'>): Promise<Inspection> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const inspections = getFromStorage<Inspection>(STORAGE_KEYS.inspections);
      const newInspection: Inspection = {
        ...inspection,
        id: Date.now().toString(),
      };
      inspections.unshift(newInspection);
      saveToStorage(STORAGE_KEYS.inspections, inspections);
      resolve(newInspection);
    }, 500);
  });
}

// Inventory
export async function getInventory(): Promise<InventoryItem[]> {
  initializeStorage();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getFromStorage<InventoryItem>(STORAGE_KEYS.inventory));
    }, 300);
  });
}

export async function addInventoryItem(item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const inventory = getFromStorage<InventoryItem>(STORAGE_KEYS.inventory);
      const newItem: InventoryItem = {
        ...item,
        id: Date.now().toString(),
      };
      inventory.push(newItem);
      saveToStorage(STORAGE_KEYS.inventory, inventory);
      resolve(newItem);
    }, 300);
  });
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const inventory = getFromStorage<InventoryItem>(STORAGE_KEYS.inventory);
      const index = inventory.findIndex(item => item.id === id);
      
      if (index !== -1) {
        inventory[index] = { ...inventory[index], ...updates };
        saveToStorage(STORAGE_KEYS.inventory, inventory);
        resolve(inventory[index]);
      } else {
        resolve(null);
      }
    }, 300);
  });
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const inventory = getFromStorage<InventoryItem>(STORAGE_KEYS.inventory);
      const filtered = inventory.filter(item => item.id !== id);
      saveToStorage(STORAGE_KEYS.inventory, filtered);
      resolve(true);
    }, 300);
  });
}

// Work Orders
export async function getWorkOrders(): Promise<WorkOrder[]> {
  initializeStorage();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getFromStorage<WorkOrder>(STORAGE_KEYS.workOrders));
    }, 300);
  });
}

export async function createWorkOrder(workOrder: Omit<WorkOrder, 'id' | 'woNumber'>): Promise<WorkOrder> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const workOrders = getFromStorage<WorkOrder>(STORAGE_KEYS.workOrders);
      const woNumber = `WO-${new Date().getFullYear()}-${String(workOrders.length + 1).padStart(3, '0')}`;
      
      const newWorkOrder: WorkOrder = {
        ...workOrder,
        id: Date.now().toString(),
        woNumber,
      };

      // Update inventory quantities
      const inventory = getFromStorage<InventoryItem>(STORAGE_KEYS.inventory);
      workOrder.items.forEach(item => {
        const inventoryItem = inventory.find(inv => inv.name === item.itemName);
        if (inventoryItem && inventoryItem.available >= item.quantity) {
          inventoryItem.available -= item.quantity;
          inventoryItem.used += item.quantity;
        }
      });
      saveToStorage(STORAGE_KEYS.inventory, inventory);

      workOrders.unshift(newWorkOrder);
      saveToStorage(STORAGE_KEYS.workOrders, workOrders);
      resolve(newWorkOrder);
    }, 500);
  });
}

// Dashboard Stats
export async function getDashboardStats(): Promise<DashboardStats> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const trailers = getFromStorage<Trailer>(STORAGE_KEYS.trailers);
      const inspections = getFromStorage<Inspection>(STORAGE_KEYS.inspections);
      const inventory = getFromStorage<InventoryItem>(STORAGE_KEYS.inventory);

      // Count pending inspections (trailers that haven't been inspected in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentInspections = inspections.filter(
        insp => new Date(insp.date) >= thirtyDaysAgo
      );
      const inspectedTrailerIds = new Set(recentInspections.map(insp => insp.trailerId));
      const inspectionsPending = trailers.length - inspectedTrailerIds.size;

      const usedInventory = inventory.reduce((sum, item) => sum + item.used, 0);
      const pendingInventory = inventory.reduce((sum, item) => sum + item.pending, 0);

      resolve({
        totalTrailers: trailers.length,
        inspectionsPending,
        usedInventory,
        pendingInventory,
      });
    }, 300);
  });
}