
import React, { useRef, useState } from 'react';
import { useForgeStore } from '../store';
import { ICONS } from '../constants';
import { Customer, CustomerStatus } from '../types';

export interface NewCustomerForm {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  spouseName: string;
  children: string;
  notes: string;
  status: CustomerStatus;
}

// Last Contact is left unset on creation; it only records real contact.
export const buildNewCustomer = (form: NewCustomerForm): Omit<Customer, 'id' | 'activityLog'> => ({
  firstName: form.firstName,
  lastName: form.lastName,
  company: form.company,
  emails: [form.email].filter(Boolean),
  phones: [form.phone].filter(Boolean),
  address: form.address,
  spouseName: form.spouseName,
  childrenNames: form.children.split(',').map(s => s.trim()).filter(Boolean),
  lastContactDate: '',
  lastContactNotes: '',
  importantDates: [],
  tags: [],
  status: form.status,
  notes: form.notes
});

export const lastContactLabel = (date?: string | null): string => (date ? date : 'Not contacted');

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const customerMatchesSearch = (c: Customer, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [`${c.firstName} ${c.lastName}`, c.company, c.address, ...(c.emails || [])]
    .filter(Boolean)
    .some(v => v.toLowerCase().includes(q));
  if (text) return true;
  const qDigits = digitsOnly(q);
  return qDigits.length > 0 && (c.phones || []).some(p => digitsOnly(p).includes(qDigits));
};

const getScrollParent = (el: HTMLElement | null): HTMLElement | null => {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? null;
};

export const CustomerProfile: React.FC<{ customer: Customer; onBack: () => void }> = ({ customer, onBack }) => {
  const email = customer.emails?.[0];
  const phone = customer.phones?.[0];
  const fullName = `${customer.firstName} ${customer.lastName}`;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-8 animate-in slide-in-from-right duration-300">
      <button
        type="button"
        onClick={onBack}
        className="lg:hidden w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-indigo-600 bg-slate-50 border-b border-slate-100"
      >
        <ICONS.ChevronRight className="w-4 h-4 rotate-180" />
        Back to results
      </button>
      <div className="bg-indigo-600 p-8 text-white relative">
        <div className="flex justify-between items-start mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl font-bold">
            {customer.firstName[0]}{customer.lastName[0]}
          </div>
          {email ? (
            <a href={`mailto:${email}`} aria-label={`Email ${fullName}`} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold">
              <ICONS.Mail className="w-5 h-5" />
              Email
            </a>
          ) : (
            <span className="p-2 text-sm text-indigo-200">No email</span>
          )}
        </div>
        <h3 className="text-2xl font-bold">{fullName}</h3>
        <p className="text-indigo-100 text-sm font-medium">{customer.company}</p>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Family Context</h4>
          <div className="bg-slate-50 p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Spouse</span>
              <span className="font-semibold text-slate-800">{customer.spouseName || 'N/A'}</span>
            </div>
            {customer.childrenNames.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Children</span>
                <span className="font-semibold text-slate-800">{customer.childrenNames.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Location & Contact</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <ICONS.Calendar className="w-4 h-4 text-slate-300 mt-1" />
              <p className="text-sm text-slate-600">{customer.address || 'No address provided'}</p>
            </div>
            <div className="flex items-center gap-3">
              <ICONS.Phone className="w-4 h-4 text-slate-300" />
              {phone ? (
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-sm text-indigo-600 hover:underline">{phone}</a>
              ) : (
                <p className="text-sm text-slate-600">No phone</p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Operational Notes</h4>
          <p className="text-sm text-slate-600 italic">"{customer.notes || 'No notes yet.'}"</p>
          <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Contact</span>
            <span className="text-[10px] text-slate-500">{lastContactLabel(customer.lastContactDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CustomerCRM: React.FC = () => {
  const { data, addCustomer, updateCustomer } = useForgeStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);

  const handleSelect = (customer: Customer) => {
    savedScroll.current = getScrollParent(listRef.current)?.scrollTop ?? 0;
    setSelectedCustomer(customer);
  };

  const handleBack = () => {
    setSelectedCustomer(null);
    requestAnimationFrame(() => {
      const scroller = getScrollParent(listRef.current);
      if (scroller) scroller.scrollTop = savedScroll.current;
    });
  };

  // Form State for New Customer
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    spouseName: '',
    children: '',
    notes: '',
    status: 'lead' as CustomerStatus
  });

  const filteredCustomers = data.customers.filter(c => customerMatchesSearch(c, searchTerm));

  const getStatusColor = (status: CustomerStatus) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'lead': return 'bg-indigo-100 text-indigo-700';
      case 'quoted': return 'bg-amber-100 text-amber-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'dormant': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCustomer(buildNewCustomer(newCustomer));
    setShowAddModal(false);
    setNewCustomer({
      firstName: '',
      lastName: '',
      company: '',
      email: '',
      phone: '',
      address: '',
      spouseName: '',
      children: '',
      notes: '',
      status: 'lead'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative">
          <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search relationships..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 w-80 outline-none"
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold transition-colors shadow-lg shadow-indigo-200"
        >
          <ICONS.Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Customer List */}
        <div ref={listRef} className={`lg:col-span-8 space-y-4 ${selectedCustomer ? 'hidden lg:block' : ''}`}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Last Contact</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(customer => (
                  <tr 
                    key={customer.id} 
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedCustomer?.id === customer.id ? 'bg-slate-50 border-l-4 border-l-indigo-500' : ''}`}
                    onClick={() => handleSelect(customer)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                          {customer.firstName[0]}{customer.lastName[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{customer.firstName} {customer.lastName}</span>
                          <span className="text-xs text-slate-400">{customer.emails[0]}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{customer.company}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${getStatusColor(customer.status)}`}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{lastContactLabel(customer.lastContactDate)}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-indigo-600">
                        <ICONS.ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <p className="font-medium">No contacts match{searchTerm.trim() ? ` "${searchTerm.trim()}"` : ''}.</p>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="mt-3 text-sm font-bold text-indigo-600 hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Customer Detail / Profile View */}
        <div className={`lg:col-span-4 ${selectedCustomer ? '' : 'hidden lg:block'}`}>
          {selectedCustomer ? (
            <CustomerProfile customer={selectedCustomer} onBack={handleBack} />
          ) : (
            <div className="h-full bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <ICONS.Users className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">Select a client to view deep profile details</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Client Modal - Resized to Half-size (max-w-md) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Add New Client</h3>
                <p className="text-xs text-slate-500 font-medium">Create a long-term relationship record.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                 <ICONS.Archive className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">First Name</label>
                  <input required type="text" value={newCustomer.firstName} onChange={e => setNewCustomer({...newCustomer, firstName: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Name</label>
                  <input required type="text" value={newCustomer.lastName} onChange={e => setNewCustomer({...newCustomer, lastName: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company / Builder</label>
                <input required type="text" value={newCustomer.company} onChange={e => setNewCustomer({...newCustomer, company: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</label>
                <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</label>
                <input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Address</label>
                <input type="text" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Personal Details</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Spouse Name</label>
                    <input type="text" value={newCustomer.spouseName} onChange={e => setNewCustomer({...newCustomer, spouseName: e.target.value})} className="w-full px-4 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Children (comma sep)</label>
                    <input type="text" value={newCustomer.children} onChange={e => setNewCustomer({...newCustomer, children: e.target.value})} className="w-full px-4 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operational Notes</label>
                <textarea value={newCustomer.notes} onChange={e => setNewCustomer({...newCustomer, notes: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none text-sm" placeholder="Prefs, personality notes..." />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm">
                  Save Relationship
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-all text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
