import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Edit,
  Mail,
  Phone,
  MapPin,
  Star,
  FileDown,
  X,
} from 'lucide-react';
import { Supplier } from '../../types/erp';
import { Badge } from '../common/Badge';
import { exportToCSV } from '../../utils/export';
import { saveSupplier } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface SupplierViewProps {
  suppliers: Supplier[];
}

export const SupplierView: React.FC<SupplierViewProps> = ({ suppliers }) => {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [rating, setRating] = useState<number>(5);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const openModal = (s?: Supplier) => {
    if (s) {
      setEditingSupplier(s);
      setCode(s.code);
      setName(s.name);
      setContactPerson(s.contactPerson);
      setEmail(s.email);
      setPhone(s.phone);
      setAddress(s.address);
      setPaymentTerms(s.paymentTerms);
      setRating(s.rating);
      setStatus(s.status);
    } else {
      setEditingSupplier(null);
      setCode(`SUP-${Math.floor(100 + Math.random() * 900)}`);
      setName('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      setAddress('');
      setPaymentTerms('Net 30');
      setRating(5);
      setStatus('active');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    try {
      await saveSupplier(
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          contactPerson: contactPerson.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          paymentTerms: paymentTerms.trim(),
          rating: Number(rating) || 5,
          status,
        },
        editingSupplier?.id,
        currentUser?.email || 'admin'
      );
      setModalOpen(false);
    } catch (err) {
      console.error('Error saving supplier:', err);
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['Code', 'Name', 'Contact Person', 'Email', 'Phone', 'Address', 'Payment Terms', 'Rating', 'Status'];
    const rows = filteredSuppliers.map((s) => [
      s.code,
      s.name,
      s.contactPerson,
      s.email,
      s.phone,
      s.address,
      s.paymentTerms,
      s.rating,
      s.status,
    ]);
    exportToCSV('Suppliers_Directory', headers, rows);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Supplier Vendor Directory</h1>
              <p className="text-xs text-slate-500">
                Manage raw material chemical houses, packaging printers, payment terms, and vendor quality ratings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search suppliers by name, code, contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((s) => (
          <div
            key={s.id}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-600 block">{s.code}</span>
                  <h3 className="font-bold text-slate-900 text-sm mt-0.5">{s.name}</h3>
                </div>
                <Badge status={s.status} />
              </div>

              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={idx}
                    className={`w-3.5 h-3.5 ${
                      idx < s.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                    }`}
                  />
                ))}
                <span className="text-xs text-slate-500 ml-1">({s.rating}/5)</span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                {s.contactPerson && (
                  <div className="font-medium text-slate-800">Contact: {s.contactPerson}</div>
                )}
                {s.email && (
                  <div className="flex items-center gap-1.5 text-slate-500 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{s.email}</span>
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{s.phone}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{s.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Terms: <strong className="text-slate-700">{s.paymentTerms}</strong>
              </span>
              <button
                onClick={() => openModal(s)}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Apex Chem Supplies"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="SUP-001"
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Robert Sterling"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Net 30, Advance, Net 45"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="orders@supplier.com"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Facility address..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rating (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
