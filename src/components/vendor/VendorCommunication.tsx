/**
 * 🎥 COMMUNICATION VENDEUR AVEC AGORA - 224SOLUTIONS
 * Interface de communication professionnelle avec appels audio/vidéo
 */

import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAgora } from "@/hooks/useAgora";
import {
  Phone, Video, PhoneOff, Mic, MicOff, VideoOff as VideoOffIcon,
  MessageSquare, Users, Search, Signal
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  avatar_url?: string;
}

export default function VendorCommunication() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const {
    callState,
    isInitialized,
    isLoading,
    startCall,
    endCall,
    toggleMute,
    toggleVideo
  } = useAgora();

  // Agora s'initialise désormais à la demande (useAgora.joinCall/startCall).
  // On évite d'appeler l'edge function au montage afin de ne pas générer
  // des erreurs "Non autorisé" quand il n'y a pas de session Supabase.

  // Charger les contacts
  useEffect(() => {
    loadContacts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, status, avatar_url')
        .neq('id', user?.id)
        .limit(20);

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
      toast({
        title: "Erreur",
        description: t('vendorCommunication.impossibleDeChargerLesContacts'),
        variant: "destructive"
      });
    }
  };

  const handleStartAudioCall = async (contact: Contact) => {
    try {
      setSelectedContact(contact);
      await startCall(contact.id, false);
    } catch (error) {
      console.error('Erreur appel audio:', error);
    }
  };

  const handleStartVideoCall = async (contact: Contact) => {
    try {
      setSelectedContact(contact);
      await startCall(contact.id, true);
    } catch (error) {
      console.error('Erreur appel vidéo:', error);
    }
  };

  const handleEndCall = async () => {
    await endCall();
    setSelectedContact(null);
  };

  const filteredContacts = contacts.filter(contact =>
    `${contact.first_name} ${contact.last_name} ${contact.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const getNetworkQualityLabel = (quality: number) => {
    if (quality === 0) return "Excellent";
    if (quality === 1) return "Bon";
    if (quality === 2) return "Moyen";
    if (quality === 3) return "Faible";
    return "Très faible";
  };

  const getNetworkQualityColor = (quality: number) => {
    if (quality === 0) return "text-[#ff4000]";
    if (quality === 1) return "text-blue-600";
    if (quality === 2) return "text-[#ff4000]";
    return "text-[#ff4000]";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-primary" />
                Communication Professionnelle
              </CardTitle>
              <CardDescription>
                Appels audio/vidéo via Agora
                {isInitialized && (
                  <Badge variant="secondary" className="ml-2">
                    🟢 Agora connecté
                  </Badge>
                )}
              </CardDescription>
            </div>
            {callState.isInCall && (
              <Badge variant="default" className="gap-2">
                <Signal className="w-4 h-4 animate-pulse" />
                En appel
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des contacts */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5" />
              Contacts
            </CardTitle>
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('vendorCommunication.rechercherUnContact')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                      selectedContact?.id === contact.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-background hover:bg-accent'
                    }`}
                    onClick={() => setSelectedContact(contact)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                          {contact.first_name?.[0]}{contact.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {contact.first_name} {contact.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contact.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartAudioCall(contact);
                          }}
                          disabled={!isInitialized || callState.isInCall}
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartVideoCall(contact);
                          }}
                          disabled={!isInitialized || callState.isInCall}
                        >
                          <Video className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Zone d'appel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Zone d'appel</CardTitle>
            <CardDescription>
              {callState.isInCall
                ? `En communication avec ${selectedContact?.first_name} ${selectedContact?.last_name}`
                : 'Sélectionnez un contact et démarrez un appel'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
              {!callState.isInCall ? (
                <div className="text-center space-y-4">
                  <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="w-16 h-16 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Prêt à communiquer
                    </h3>
                    <p className="text-muted-foreground">
                      {isInitialized
                        ? 'Sélectionnez un contact pour démarrer un appel audio ou vidéo'
                        : 'Configuration d\'Agora en cours...'}
                    </p>
                  </div>
                  {!isInitialized && (
                    <Badge variant="secondary" className="gap-2">
                      <Signal className="w-4 h-4 animate-pulse" />
                      Connexion à Agora...
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="w-full space-y-6">
                  {/* Informations de l'appel */}
                  <div className="text-center space-y-3">
                    <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto text-white text-3xl font-bold">
                      {selectedContact?.first_name?.[0]}{selectedContact?.last_name?.[0]}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">
                        {selectedContact?.first_name} {selectedContact?.last_name}
                      </h3>
                      <p className="text-muted-foreground">
                        {callState.isVideoEnabled ? 'Appel vidéo' : 'Appel audio'}
                      </p>
                    </div>

                    {/* Qualité réseau */}
                    <div className="flex items-center justify-center gap-2">
                      <Signal className={`w-4 h-4 ${getNetworkQualityColor(callState.networkQuality)}`} />
                      <span className={`text-sm font-medium ${getNetworkQualityColor(callState.networkQuality)}`}>
                        {getNetworkQualityLabel(callState.networkQuality)}
                      </span>
                    </div>
                  </div>

                  {/* Vidéo locale (si appel vidéo) */}
                  {callState.isVideoEnabled && (
                    <div className="w-full aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
                      <Video className="w-16 h-16 text-slate-500" />
                    </div>
                  )}

                  {/* Contrôles d'appel */}
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      size="lg"
                      variant={callState.isMuted ? "destructive" : "secondary"}
                      className="rounded-full w-14 h-14"
                      onClick={toggleMute}
                    >
                      {callState.isMuted ? (
                        <MicOff className="w-6 h-6" />
                      ) : (
                        <Mic className="w-6 h-6" />
                      )}
                    </Button>

                    {callState.isVideoEnabled !== undefined && (
                      <Button
                        size="lg"
                        variant={callState.isVideoEnabled ? "secondary" : "destructive"}
                        className="rounded-full w-14 h-14"
                        onClick={toggleVideo}
                      >
                        {callState.isVideoEnabled ? (
                          <Video className="w-6 h-6" />
                        ) : (
                          <VideoOffIcon className="w-6 h-6" />
                        )}
                      </Button>
                    )}

                    <Button
                      size="lg"
                      variant="destructive"
                      className="rounded-full w-14 h-14"
                      onClick={handleEndCall}
                    >
                      <PhoneOff className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
