/**
 * MODULE AGENCE IMMOBILIÈRE - v3
 * Dashboard moderne avec Google Maps, recherche avancée, wallet et copilote IA
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useRealEstateData } from '@/hooks/useRealEstateData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Home, Building2, Users, Calendar, MapPin, Phone, Mail,
  Plus, Eye, DollarSign,
  Loader2, CheckCircle, XCircle, Map, Wallet, KeyRound
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { PropertyCard } from './real-estate/PropertyCard';
import { NewPropertyDialog } from './real-estate/NewPropertyDialog';
import { PropertyDetailDialog } from './real-estate/PropertyDetailDialog';
import { AdvancedSearchPanel, DEFAULT_FILTERS, type SearchFilters } from './real-estate/AdvancedSearchPanel';
import { RealEstateMapView } from './real-estate/RealEstateMapView';
import { RealEstateWalletWidget } from './real-estate/RealEstateWalletWidget';
import { RealEstateCopilot } from './real-estate/RealEstateCopilot';
import { RealEstateRentals } from './real-estate/RealEstateRentals';
import type { Property } from '@/hooks/useRealEstateData';

interface RealEstateModuleProps {
  serviceId: string;
  businessName?: string;
}

export function RealEstateModule({ serviceId, businessName }: RealEstateModuleProps) {
  const { t } = useTranslation();
  const {
    properties, visits, contacts, stats, loading, saving,
    createProperty, updatePropertyStatus, deleteProperty,
    createVisit, updateVisitStatus, createContact, refresh,
  } = useRealEstateData(serviceId);

  const [activeTab, setActiveTab] = useState('annonces');
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  // Visit form state
  const [visitForm, setVisitForm] = useState({
    property_id: '', client_name: '', client_phone: '', client_email: '',
    visit_date: '', visit_time: '', notes: ''
  });

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '', phone: '', email: '', contact_type: 'acheteur',
    budget: '', notes: ''
  });

  const formatPrice = useFormatCurrency();

  // Extract unique cities for filter
  const cities = useMemo(() => {
    const citySet = new Set(properties.map(p => p.city).filter(Boolean) as string[]);
    return Array.from(citySet).sort();
  }, [properties]);

  // Apply advanced filters
  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      if (filters.query) {
        const q = filters.query.toLowerCase();
        const match = p.title.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.neighborhood?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.offer_type !== 'all' && p.offer_type !== filters.offer_type) return false;
      if (filters.property_type !== 'all' && p.property_type !== filters.property_type) return false;
      if (filters.city && p.city !== filters.city) return false;
      if (filters.status !== 'all' && p.status !== filters.status) return false;
      if (p.price < filters.min_price) return false;
      if (p.price > filters.max_price) return false;
      if (filters.min_rooms > 0 && p.rooms < filters.min_rooms) return false;
      return true;
    });
  }, [properties, filters]);

  const openPropertyDetail = (property: Property) => {
    setSelectedProperty(property);
    setShowDetail(true);
  };

  const handleAddVisit = async () => {
    if (!visitForm.client_name || !visitForm.visit_date) {
      toast.error(t('realEstateModule.nomEtDateRequis'));
      return;
    }
    const ok = await createVisit(visitForm);
    if (ok) {
      setVisitForm({ property_id: '', client_name: '', client_phone: '', client_email: '', visit_date: '', visit_time: '', notes: '' });
      setShowNewVisit(false);
    }
  };

  const handleAddContact = async () => {
    if (!contactForm.name) {
      toast.error('Nom requis');
      return;
    }
    const ok = await createContact({
      ...contactForm,
      budget: contactForm.budget ? parseFloat(contactForm.budget) : undefined,
    });
    if (ok) {
      setContactForm({ name: '', phone: '', email: '', contact_type: 'acheteur', budget: '', notes: '' });
      setShowNewContact(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t('realEstateModule.chargementDuModuleImmobilier')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Home className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">{businessName || 'Agence Immobilière'}</h2>
            <p className="text-sm text-muted-foreground">{t('realEstateModule.gestionCompleteDeVosBiens')}</p>
          </div>
        </div>
        <Button onClick={() => setShowNewProperty(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Publier un bien
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total biens</p>
                <p className="text-2xl font-bold">{stats.totalProperties}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Disponibles</p>
                <p className="text-2xl font-bold">{stats.available}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{t('realEstateModule.visitesAVenir')}</p>
                <p className="text-2xl font-bold">{stats.pendingVisits}</p>
              </div>
              <Calendar className="h-8 w-8 text-accent/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-secondary-foreground/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Contacts</p>
                <p className="text-2xl font-bold">{stats.totalContacts}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats bar */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <DollarSign className="h-3 w-3" /> {stats.forSale} à vendre
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Home className="h-3 w-3" /> {stats.forRent} à louer
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Eye className="h-3 w-3" /> {stats.totalViews} vues totales
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="annonces" className="gap-1 text-xs sm:text-sm">
            <Building2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Biens</span>
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-1 text-xs sm:text-sm">
            <KeyRound className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Locations</span>
          </TabsTrigger>
          <TabsTrigger value="carte" className="gap-1 text-xs sm:text-sm">
            <Map className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Carte</span>
          </TabsTrigger>
          <TabsTrigger value="visites" className="gap-1 text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Visites</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="wallet" className="gap-1 text-xs sm:text-sm">
            <Wallet className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Wallet</span>
          </TabsTrigger>
        </TabsList>

        {/* === BIENS === */}
        <TabsContent value="annonces" className="space-y-4">
          <AdvancedSearchPanel
            filters={filters}
            onFiltersChange={setFilters}
            cities={cities}
          />

          {filteredProperties.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-semibold text-lg">{t('realEstateModule.aucunBienImmobilier')}</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {filters.query ? 'Aucun résultat pour votre recherche' : 'Commencez par publier votre premier bien'}
                </p>
                {!filters.query && (
                  <Button onClick={() => setShowNewProperty(true)} className="mt-4 gap-2">
                    <Plus className="h-4 w-4" /> Publier un bien
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredProperties.map(property => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onStatusChange={updatePropertyStatus}
                  onDelete={deleteProperty}
                  onClick={() => openPropertyDetail(property)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* === CARTE === */}
        <TabsContent value="carte" className="space-y-4">
          <RealEstateMapView
            properties={filteredProperties}
            onPropertyClick={openPropertyDetail}
          />
          {/* List below map */}
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredProperties.filter(p => p.latitude && p.longitude).map(property => (
              <Card
                key={property.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openPropertyDetail(property)}
              >
                <CardContent className="p-3 flex gap-3">
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {property.images?.[0] ? (
                      <img src={property.images[0].image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <MapPin className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{property.title}</p>
                    <p className="text-primary font-bold text-sm">{formatPrice(property.price)}</p>
                    <p className="text-xs text-muted-foreground truncate">{property.city}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* === VISITES === */}
        <TabsContent value="visites" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Visites planifiées ({visits.length})</h3>
            <Dialog open={showNewVisit} onOpenChange={setShowNewVisit}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Planifier</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('realEstateModule.planifierUneVisite')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {properties.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t('realEstateModule.bienConcerne')}</Label>
                      <Select value={visitForm.property_id} onValueChange={v => setVisitForm(prev => ({...prev, property_id: v}))}>
                        <SelectTrigger><SelectValue placeholder={t('realEstateModule.selectionnerUnBien')} /></SelectTrigger>
                        <SelectContent>
                          {properties.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{t('realEstateModule.nomDuClient')}</Label>
                    <Input value={visitForm.client_name} onChange={e => setVisitForm(prev => ({...prev, client_name: e.target.value}))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('realEstateModule.telephone')}</Label>
                      <Input value={visitForm.client_phone} onChange={e => setVisitForm(prev => ({...prev, client_phone: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={visitForm.client_email} onChange={e => setVisitForm(prev => ({...prev, client_email: e.target.value}))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input type="date" value={visitForm.visit_date} onChange={e => setVisitForm(prev => ({...prev, visit_date: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Heure</Label>
                      <Input type="time" value={visitForm.visit_time} onChange={e => setVisitForm(prev => ({...prev, visit_time: e.target.value}))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={visitForm.notes} onChange={e => setVisitForm(prev => ({...prev, notes: e.target.value}))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewVisit(false)}>{t('realEstateModule.annuler')}</Button>
                  <Button onClick={handleAddVisit}>Planifier</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {visits.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">{t('realEstateModule.aucuneVisitePlanifiee')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {visits.map(visit => (
                <Card key={visit.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{visit.client_name}</h4>
                          <Badge variant={
                            visit.status === 'planifiee' ? 'default' :
                            visit.status === 'effectuee' ? 'secondary' : 'destructive'
                          }>
                            {visit.status === 'planifiee' ? '📅 Planifiée' :
                             visit.status === 'effectuee' ? '✅ Effectuée' : '❌ Annulée'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {visit.visit_date} {visit.visit_time && `à ${visit.visit_time}`}
                          </span>
                          {visit.client_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {visit.client_phone}
                            </span>
                          )}
                        </div>
                        {visit.notes && <p className="text-xs text-muted-foreground mt-1">{visit.notes}</p>}
                      </div>
                      {visit.status === 'planifiee' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => updateVisitStatus(visit.id, 'effectuee')}>
                            <CheckCircle className="h-4 w-4 text-primary" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateVisitStatus(visit.id, 'annulee')}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* === CONTACTS === */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Contacts ({contacts.length})</h3>
            <Dialog open={showNewContact} onOpenChange={setShowNewContact}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> {t('realEstateModule.ajouter')}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('realEstateModule.ajouterUnContact')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={contactForm.name} onChange={e => setContactForm(prev => ({...prev, name: e.target.value}))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('realEstateModule.telephone')}</Label>
                      <Input value={contactForm.phone} onChange={e => setContactForm(prev => ({...prev, phone: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={contactForm.email} onChange={e => setContactForm(prev => ({...prev, email: e.target.value}))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={contactForm.contact_type} onValueChange={v => setContactForm(prev => ({...prev, contact_type: v}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="acheteur">Acheteur</SelectItem>
                          <SelectItem value="vendeur">{t('realEstateModule.vendeur')}</SelectItem>
                          <SelectItem value="locataire">Locataire</SelectItem>
                          <SelectItem value="bailleur">Bailleur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Budget (GNF)</Label>
                      <Input type="number" value={contactForm.budget} onChange={e => setContactForm(prev => ({...prev, budget: e.target.value}))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={contactForm.notes} onChange={e => setContactForm(prev => ({...prev, notes: e.target.value}))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewContact(false)}>{t('realEstateModule.annuler')}</Button>
                  <Button onClick={handleAddContact}>{t('realEstateModule.ajouter')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {contacts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">{t('realEstateModule.aucunContactEnregistre')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map(contact => (
                <Card key={contact.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{contact.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {contact.contact_type === 'acheteur' ? '🔑 Acheteur' :
                         contact.contact_type === 'vendeur' ? '💰 Vendeur' :
                         contact.contact_type === 'locataire' ? '📋 Locataire' : '🏠 Bailleur'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {contact.phone && (
                        <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {contact.phone}</p>
                      )}
                      {contact.email && (
                        <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {contact.email}</p>
                      )}
                      {contact.budget && (
                        <p className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Budget: {formatPrice(contact.budget)}</p>
                      )}
                    </div>
                    {contact.notes && <p className="text-xs text-muted-foreground mt-2 italic">{contact.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* === WALLET === */}
        <TabsContent value="locations" className="space-y-4">
          <RealEstateRentals serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <RealEstateWalletWidget />
        </TabsContent>
      </Tabs>

      {/* New Property Dialog */}
      <NewPropertyDialog
        open={showNewProperty}
        onClose={() => setShowNewProperty(false)}
        onSubmit={createProperty}
        saving={saving}
      />

      {/* Property Detail Dialog */}
      <PropertyDetailDialog
        property={selectedProperty}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        onRefresh={refresh}
        isOwner={true}
      />

      {/* Copilote IA flottant */}
      <RealEstateCopilot stats={stats} />
    </div>
  );
}
