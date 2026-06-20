/**
 * SYSTÈME D'ÉLECTIONS SYNDICALES ULTRA PROFESSIONNEL
 * Interface complète pour la gouvernance démocratique
 * 224Solutions - Bureau Syndicat System
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Vote, Users, Calendar, Trophy, Plus, CheckCircle } from "lucide-react";

interface SyndicateElectionsProps {
    bureauId: string;
}

export default function SyndicateElections({ bureauId }: SyndicateElectionsProps) {
    const { t } = useTranslation();
    const [electionStats] = useState({
        activeElections: 1,
        totalVoters: 42,
        completedElections: 3,
        upcomingElections: 0
    });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6 text-center">
                        <Vote className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold text-blue-600">{electionStats.activeElections}</div>
                        <div className="text-sm text-gray-600">{t('syndicateElections.electionsActives')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 text-[#ff4000]" />
                        <div className="text-2xl font-bold text-[#ff4000]">{electionStats.totalVoters}</div>
                        <div className="text-sm text-gray-600">{t('syndicateElections.electeursInscrits')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 text-center">
                        <Trophy className="w-8 h-8 mx-auto mb-2 text-[#ff4000]" />
                        <div className="text-2xl font-bold text-[#ff4000]">{electionStats.completedElections}</div>
                        <div className="text-sm text-gray-600">{t('syndicateElections.electionsTerminees')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 text-center">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-[#04439e]" />
                        <div className="text-2xl font-bold text-[#04439e]">{electionStats.upcomingElections}</div>
                        <div className="text-sm text-gray-600">{t('syndicateElections.aVenir')}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Élections en Cours
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Nouvelle Élection
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="border rounded-lg p-4 bg-blue-50">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold">{t('syndicateElections.electionDuSecretaireGeneral')}</h3>
                                <Badge className="bg-blue-100 text-blue-800">En cours</Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-600">Candidats</p>
                                    <p className="font-bold">3</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">{t('syndicateElections.votesRecus')}</p>
                                    <p className="font-bold">28/42</p>
                                </div>
                                <div>
                                    <p className="text-gray-600">{t('syndicateElections.finDuVote')}</p>
                                    <p className="font-bold">2 jours</p>
                                </div>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <Button size="sm" variant="outline">
                                    <Vote className="w-4 h-4 mr-2" />
                                    Voir Résultats
                                </Button>
                                <Button size="sm" variant="outline">
                                    <Users className="w-4 h-4 mr-2" />
                                    Candidats
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('syndicateElections.gouvernanceDemocratique')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <Vote className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            Système Électoral Sécurisé
                        </h3>
                        <p className="text-gray-600 mb-4">
                            Élections transparentes avec votes cryptés et résultats automatiques
                        </p>
                        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                            <div className="space-y-2">
                                <CheckCircle className="w-6 h-6 mx-auto text-[#ff4000]" />
                                <div className="text-sm">
                                    <div className="font-medium">{t('syndicateElections.votesCryptes')}</div>
                                    <div className="text-xs text-gray-600">{t('syndicateElections.securiteMaximale')}</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Trophy className="w-6 h-6 mx-auto text-[#ff4000]" />
                                <div className="text-sm">
                                    <div className="font-medium">{t('syndicateElections.resultatsAuto')}</div>
                                    <div className="text-xs text-gray-600">Transparence totale</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
