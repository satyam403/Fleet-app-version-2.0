# FleetOps - Fleet Management Web Application

A production-ready fleet management system built with React, TypeScript, and modern web technologies.

## Features

### 🚛 Core Functionality
- **Dashboard**: Real-time statistics, inventory usage charts, and inspection status overview
- **DOT Inspection**: Complete digital inspection workflow with PDF report generation
- **Work Orders**: Create and manage work orders with automatic inventory tracking
- **Inventory Management**: Track available, used, and pending inventory items
- **Multi-language Support**: English, Spanish (Spain), and Spanish (Mexico)

### 🌍 Internationalization (i18n)
- Complete translation support for 3 languages
- Instant language switching without page reload
- Language preference saved in localStorage
- All UI elements, labels, and messages are translatable

### 📄 PDF Generation
- Professional DOT Inspection Reports
- Work Order PDFs with parts list and signatures
- Client-side PDF generation using pdf-lib
- Automatic download after submission

### 💾 Data Persistence
- LocalStorage-based data storage
- Pre-seeded with sample data
- Automatic inventory quantity updates
- Work order history tracking

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **React Router** (Data mode) for navigation
- **Tailwind CSS** for styling
- **i18next** for internationalization
- **Recharts** for data visualization
- **pdf-lib** for PDF generation
- **Sonner** for toast notifications
- **Lucide React** for icons

### Architecture
- Component-based architecture
- Custom API service layer
- Type-safe TypeScript interfaces
- Responsive design for all screen sizes

## Project Structure

```
/
├── App.tsx                 # Main app component with i18n provider
├── routes.ts              # React Router configuration
├── types/
│   └── index.ts           # TypeScript interfaces and types
├── i18n/
│   ├── config.ts          # i18next configuration
│   └── locales/
│       ├── en.json        # English translations
│       ├── es.json        # Spanish translations
│       └── es-MX.json     # Mexican Spanish translations
├── components/
│   ├── Layout.tsx         # Main layout with sidebar navigation
│   └── LanguageSwitcher.tsx  # Language selector component
├── pages/
│   ├── Dashboard.tsx      # Dashboard with stats and charts
│   ├── Inspection.tsx     # DOT inspection form
│   ├── WorkOrders.tsx     # Work order creation and history
│   ├── Inventory.tsx      # Inventory management
│   ├── Settings.tsx       # Settings page with language selector
│   └── NotFound.tsx       # 404 page
└── services/
    ├── api.ts             # Data service layer (localStorage)
    └── pdf.ts             # PDF generation utilities
```

## Getting Started

### Installation

This application is ready to run in the Figma Make environment. All dependencies are automatically managed.

### Usage

1. **Dashboard**: View fleet statistics and recent activity
2. **DOT Inspection**: 
   - Select a trailer
   - Complete the 7-point inspection checklist
   - Submit to generate a PDF report
3. **Work Orders**:
   - Create new work orders with issue descriptions
   - Add inventory items used
   - System automatically reduces inventory quantities
   - Download PDF work orders
4. **Inventory**:
   - View current stock levels
   - Add new inventory items
   - Track available, used, and pending quantities
5. **Settings**:
   - Change application language

## Data Model

### Trailer
```typescript
{
  id: string;
  number: string;
  make?: string;
  model?: string;
  year?: number;
}
```

### Inspection
```typescript
{
  id: string;
  trailerId: string;
  trailerNumber: string;
  technicianName: string;
  date: string;
  checklist: InspectionCheckItem[];
  pdfUrl?: string;
}
```

### Work Order
```typescript
{
  id: string;
  woNumber: string;
  trailerId: string;
  trailerNumber: string;
  technicianName: string;
  date: string;
  issueNotes: string;
  items: WorkOrderItem[];
  status: 'completed' | 'pending' | 'inProgress';
  pdfUrl?: string;
}
```

### Inventory Item
```typescript
{
  id: string;
  name: string;
  available: number;
  used: number;
  pending: number;
  dateAdded?: string;
  notes?: string;
}
```

## API Service Layer

The application uses a mock API layer (`/services/api.ts`) that simulates backend operations using localStorage:

### Available Functions
- `getTrailers()`: Fetch all trailers
- `getInspections()`: Fetch all inspections
- `createInspection()`: Create new inspection
- `getInventory()`: Fetch inventory items
- `addInventoryItem()`: Add new inventory item
- `updateInventoryItem()`: Update inventory quantities
- `deleteInventoryItem()`: Remove inventory item
- `getWorkOrders()`: Fetch all work orders
- `createWorkOrder()`: Create new work order (auto-updates inventory)
- `getDashboardStats()`: Calculate dashboard statistics

## PDF Generation

Professional PDF reports are generated using `pdf-lib`:

### Inspection PDF Includes:
- Company header
- Inspection details (ID, date, trailer, technician)
- Complete checklist with status and comments
- Signature section

### Work Order PDF Includes:
- Company header
- Work order number and details
- Issue description
- Parts and materials used
- Dual signature sections (technician and supervisor)

## Internationalization

### Adding a New Language

1. Create a new translation file in `/i18n/locales/`:
```json
{
  "app": {
    "name": "FleetOps",
    "tagline": "Your tagline"
  },
  "nav": { ... },
  // ... complete translation keys
}
```

2. Update `/i18n/config.ts`:
```typescript
import newLang from './locales/new-lang.json';

resources: {
  'new-lang': { translation: newLang }
}
```

3. Add to language selector components

### Translation Keys Structure
- `app.*`: Application branding
- `nav.*`: Navigation menu items
- `dashboard.*`: Dashboard page
- `inspection.*`: Inspection page
- `workOrders.*`: Work orders page
- `inventory.*`: Inventory page
- `settings.*`: Settings page
- `common.*`: Shared UI elements

## Responsive Design

The application is fully responsive:
- **Mobile**: Hamburger menu, stacked layouts
- **Tablet**: Optimized grid layouts
- **Desktop**: Full sidebar navigation, multi-column views

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Future Enhancements

### Backend Integration
Currently uses localStorage. To integrate with a real backend:

1. Replace `/services/api.ts` with actual API calls
2. Use Axios or Fetch for HTTP requests
3. Add authentication/authorization
4. Implement server-side PDF generation (optional)

### Airtable Integration Example
```typescript
import Airtable from 'airtable';

const base = new Airtable({ apiKey: 'YOUR_API_KEY' }).base('BASE_ID');

export async function getTrailers(): Promise<Trailer[]> {
  const records = await base('Trailers').select().all();
  return records.map(record => ({
    id: record.id,
    number: record.get('Number') as string,
    make: record.get('Make') as string,
    // ...
  }));
}
```

### Recommended Backend Setup
- **Node.js + Express** API server
- **Airtable** for database (as originally specified)
- **JWT** for authentication
- **Multer** for file uploads
- **Node-cron** for scheduled tasks

### Database Schema (Airtable)

#### Trailers Table
- Number (Single line text, Primary)
- Make (Single line text)
- Model (Single line text)
- Year (Number)

#### Inspections Table
- Inspection ID (Auto number)
- Trailer (Link to Trailers)
- Technician Name (Single line text)
- Date (Date)
- Checklist Data (Long text, JSON)
- PDF URL (URL)

#### Work Orders Table
- WO Number (Formula: "WO-" & YEAR(Date) & "-" & Number)
- Trailer (Link to Trailers)
- Technician Name (Single line text)
- Date (Date)
- Issue Notes (Long text)
- Items Used (Long text, JSON)
- Status (Single select: Completed, Pending, In Progress)
- PDF URL (URL)

#### Inventory Table
- Item Name (Single line text, Primary)
- Available (Number)
- Used (Number)
- Pending (Number)
- Date Added (Date)
- Notes (Long text)

## Security Considerations

When deploying to production:
- Implement proper authentication
- Use HTTPS for all communications
- Validate all user inputs
- Sanitize data before storage
- Implement rate limiting
- Add CORS policies
- Use environment variables for sensitive data

## License

MIT License - Feel free to use this project for your fleet management needs.

## Support

For questions or issues, please refer to the documentation or contact your system administrator.

---

**Built with ❤️ using React, TypeScript, and modern web technologies**
