import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Send, ArrowDownUp, Clock, CheckCircle, XCircle, Search, Filter, CreditCard, Shield, Smartphone, Wallet, Copy, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEnhancedTransactions } from "@/hooks/useEnhancedTransactions";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useTranslation } from "@/hooks/useTranslation";

export const TransactionSystem = () => {
  const { t } = useTranslation();
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount, setAmount] = useState('');
  const { wallet } = useWallet();
  // La devise est verrouillée selon le pays de résidence — non modifiable par l'utilisateur
  const currency = wallet?.currency || 'GNF';
  const [method, setMethod] = useState('wallet');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [_selectedTransaction, _setSelectedTransaction] = useState(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const {
    transactions,
    loading: transactionsLoading,
    createWalletTransaction,
    createEscrowTransaction,
    searchTransactions,
    refetch
  } = useEnhancedTransactions();

  const handleSendMoney = async () => {
    if (!receiverEmail || !amount) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      if (method === 'wallet') {
        await createWalletTransaction(receiverEmail, parseFloat(amount), currency, description);
      } else if (method === 'escrow') {
        await createEscrowTransaction(receiverEmail, parseFloat(amount), currency, description);
      }

      // Reset form
      setReceiverEmail('');
      setAmount('');
      setDescription('');
    } catch (_error) {
      // Error handled in hook
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const filters = {
      status: statusFilter || undefined,
      method: methodFilter || undefined,
    };
    searchTransactions(searchQuery, filters);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-orange-100 text-[#ff4000]"><CheckCircle className="w-3 h-3 mr-1" />{t('transactionSystem.termine')}</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-[#ff4000]"><Clock className="w-3 h-3 mr-1" />En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{t('transactionSystem.echoue')}</Badge>;
      case 'refunded':
        return <Badge className="bg-blue-100 text-blue-800">{t('transactionSystem.rembourse')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'wallet':
        return <Wallet className="w-4 h-4" />;
      case 'card':
        return <CreditCard className="w-4 h-4" />;
      case 'mobile_money':
        return <Smartphone className="w-4 h-4" />;
      case 'escrow':
        return <Shield className="w-4 h-4" />;
      default:
        return <Send className="w-4 h-4" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: "ID de transaction copié dans le presse-papiers",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t('transactionSystem.systemeDeTransactions')}</h2>
          <p className="text-muted-foreground">{t('transactionSystem.envoyezEtRecevezDeL')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-vendeur/10 text-vendeur border-vendeur/20">
            {transactions.length} transactions
          </Badge>
          <Button onClick={refetch} variant="outline" size="sm">
            Actualiser
          </Button>
        </div>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send" className="data-[state=active]:bg-vendeur data-[state=active]:text-white">
            <Send className="w-4 h-4 mr-2" />
            Envoyer
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-vendeur data-[state=active]:text-white">
            <ArrowDownUp className="w-4 h-4 mr-2" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-vendeur data-[state=active]:text-white">
            <Filter className="w-4 h-4 mr-2" />
            Recherche
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-vendeur" />
                  Envoyer de l'argent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="receiver">{t('transactionSystem.emailDuDestinataire')}</Label>
                  <Input
                    id="receiver"
                    type="email"
                    placeholder="destinataire@exemple.com"
                    value={receiverEmail}
                    onChange={(e) => setReceiverEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">{t('transactionSystem.montant')}</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Devise</Label>
                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50">
                      <span className="font-semibold text-sm">{currency}</span>
                      <span className="text-xs text-muted-foreground">{t('transactionSystem.verrouilleeSelonVotrePays')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="method">{t('transactionSystem.methodeDePaiement')}</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wallet">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          Wallet Interne (instantané)
                        </div>
                      </SelectItem>
                      <SelectItem value="escrow">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Escrow (sécurisé)
                        </div>
                      </SelectItem>
                      <SelectItem value="card" disabled>
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Carte bancaire (bientôt)
                        </div>
                      </SelectItem>
                      <SelectItem value="mobile_money" disabled>
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4" />
                          Mobile Money (bientôt)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description (optionnel)</Label>
                  <Textarea
                    id="description"
                    placeholder={t('transactionSystem.noteOuReferencePourCette')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleSendMoney}
                  className="w-full bg-vendeur-gradient text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {loading ? 'Transaction en cours...' : 'Envoyer Maintenant'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('transactionSystem.methodesDePaiementDisponibles')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Wallet className="w-5 h-5 text-vendeur" />
                    <div>
                      <h4 className="font-medium">Wallet Interne</h4>
                      <p className="text-sm text-muted-foreground">{t('transactionSystem.transactionInstantaneeEntreUtilisateurs')}</p>
                      <p className="text-xs text-vendeur">{t('transactionSystem.idUniqueGenereAutomatiquement')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium">{t('transactionSystem.escrowSecurise')}</h4>
                      <p className="text-sm text-muted-foreground">{t('transactionSystem.fondsBloquesJusquAConfirmation')}</p>
                      <p className="text-xs text-blue-600">Protection automatique</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg opacity-50">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <div>
                      <h4 className="font-medium">Carte Bancaire</h4>
                      <p className="text-sm text-muted-foreground">Visa, Mastercard, etc.</p>
                      <p className="text-xs text-gray-400">{t('transactionSystem.bientotDisponible')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 border rounded-lg opacity-50">
                    <Smartphone className="w-5 h-5 text-gray-400" />
                    <div>
                      <h4 className="font-medium">Mobile Money</h4>
                      <p className="text-sm text-muted-foreground">Orange Money, MTN, Moov</p>
                      <p className="text-xs text-gray-400">{t('transactionSystem.integrationEnCours')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('transactionSystem.historiqueDesTransactions')}</CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    placeholder={t('transactionSystem.rechercherParIdUniqueEx')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={handleSearch} variant="outline">
                  <Search className="w-4 h-4 mr-2" />
                  Rechercher
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex justify-center p-8">
                  <Clock className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Unique</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>{t('transactionSystem.montant2')}</TableHead>
                      <TableHead>{t('transactionSystem.methode')}</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date/Heure</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2">
                            {transaction.custom_id}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(transaction.custom_id)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {transaction.sender_id === user?.id ? (
                            <Badge variant="outline" className="text-[#ff4000]">{t('transactionSystem.envoye')}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[#ff4000]">{t('transactionSystem.recu')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {transaction.sender_id === user?.id ? 'À' : 'De'} {
                            transaction.sender_id === user?.id
                              ? transaction.receiver_id.substring(0, 8) + '...'
                              : transaction.sender_id.substring(0, 8) + '...'
                          }
                        </TableCell>
                        <TableCell className="font-semibold">
                          {transaction.sender_id === user?.id ? '-' : '+'}
                          {transaction.amount.toLocaleString()} {transaction.currency}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getMethodIcon(transaction.method)}
                            <span className="capitalize">{transaction.method}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(transaction.status)}
                        </TableCell>
                        <TableCell>
                          {new Date(transaction.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{t('transactionSystem.detailsDeLaTransaction')}</DialogTitle>
                                <DialogDescription>
                                  Transaction #{transaction.custom_id}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>ID Unique</Label>
                                    <p className="font-mono text-lg">{transaction.custom_id}</p>
                                  </div>
                                  <div>
                                    <Label>{t('transactionSystem.montant2')}</Label>
                                    <p className="font-semibold text-lg">{transaction.amount} {transaction.currency}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>{t('transactionSystem.methode')}</Label>
                                    <div className="flex items-center gap-2">
                                      {getMethodIcon(transaction.method)}
                                      <span className="capitalize">{transaction.method}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Statut</Label>
                                    <div>{getStatusBadge(transaction.status)}</div>
                                  </div>
                                </div>
                                {(transaction.metadata as unknown)?.description && (
                                  <div>
                                    <Label>Description</Label>
                                    <p>{(transaction.metadata as unknown)?.description}</p>
                                  </div>
                                )}
                                <div>
                                  <Label>{t('transactionSystem.dateDeCreation')}</Label>
                                  <p>{new Date(transaction.created_at).toLocaleString('fr-FR')}</p>
                                </div>
                                <div>
                                  <Label>{t('transactionSystem.derniereMiseAJour')}</Label>
                                  <p>{new Date(transaction.updated_at).toLocaleString('fr-FR')}</p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Recherche avancée et filtres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Recherche par ID unique</Label>
                  <Input
                    placeholder="ABC1234"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Filtrer par statut</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('transactionSystem.tousLesStatuts')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('transactionSystem.tousLesStatuts')}</SelectItem>
                      <SelectItem value="pending">En cours</SelectItem>
                      <SelectItem value="completed">{t('transactionSystem.termine')}</SelectItem>
                      <SelectItem value="failed">{t('transactionSystem.echoue')}</SelectItem>
                      <SelectItem value="refunded">{t('transactionSystem.rembourse')}</SelectItem>
                      <SelectItem value="cancelled">{t('transactionSystem.annule')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('transactionSystem.filtrerParMethode')}</Label>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('transactionSystem.toutesLesMethodes')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('transactionSystem.toutesLesMethodes')}</SelectItem>
                      <SelectItem value="wallet">Wallet Interne</SelectItem>
                      <SelectItem value="escrow">Escrow</SelectItem>
                      <SelectItem value="card">Carte Bancaire</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSearch} className="bg-vendeur-gradient">
                <Search className="w-4 h-4 mr-2" />
                Appliquer les filtres de recherche
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('transactionSystem.informationsSurLeSysteme')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-vendeur/5 rounded-lg border">
                  <h4 className="font-semibold text-vendeur mb-2">{t('transactionSystem.formatDesIdUniques')}</h4>
                  <p className="text-sm text-muted-foreground">
                    Chaque transaction génère automatiquement un ID unique au format 3 lettres + 4 chiffres (ex: ABC1234)
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">{t('transactionSystem.tracabiliteComplete')}</h4>
                  <p className="text-sm text-blue-600">
                    Toutes les transactions sont enregistrées avec timestamp, métadonnées et suivi complet
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};