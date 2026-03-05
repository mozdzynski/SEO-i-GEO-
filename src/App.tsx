/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  FileText, 
  TrendingUp, 
  MessageSquare, 
  CheckCircle2, 
  Download, 
  AlertCircle, 
  MapPin,
  Star,
  ArrowRight,
  Loader2,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiResponse } from './services/geminiService';
import Markdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- Types ---

interface Recommendation {
  title: string;
  description: string;
}

interface AuditReport {
  businessName: string;
  healthScore: number;
  currentStatus: string;
  marketGap: string;
  customerVoice: string;
  recommendations: Recommendation[];
  rawMarkdown: string;
}

// --- Components ---

const Header = () => (
  <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
          <TrendingUp className="text-white w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight">AI Apper</h1>
          <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold leading-none">Tomasz Możdżyński</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-6 text-sm font-medium text-black/60">
        <a href="mailto:tomasz@aiapper.com" className="hover:text-black transition-colors">tomasz@aiapper.com</a>
        <span className="text-black/10">|</span>
        <a href="tel:501453901" className="hover:text-black transition-colors">501 453 901</a>
      </div>
    </div>
  </header>
);

const HealthScore = ({ score }: { score: number }) => {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-emerald-500';
    if (s >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-black/5 shadow-sm">
      <span className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">Health Score</span>
      <div className={`text-6xl font-light ${getColor(score)} tabular-nums`}>
        {score}<span className="text-2xl opacity-50">/100</span>
      </div>
      <div className="w-full bg-black/5 h-1.5 rounded-full mt-4 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
        />
      </div>
    </div>
  );
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const generateAudit = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      let userLocation = undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (e) {
        console.log("Geolocation not available or denied");
      }

      const prompt = `
        Jesteś Ekspertem ds. Strategii AI i Marketingu Lokalnego dla marki "AI Apper Tomasz Możdżyński".
        Twoim zadaniem jest przeprowadzenie audytu wizytówki Google Maps dla firmy: "${searchQuery}".
        
        Użyj narzędzia googleMaps, aby:
        1. Znaleźć szczegóły firmy "${searchQuery}".
        2. Znaleźć najlepszego konkurenta (lidera) w promieniu 1 km od tej firmy.
        3. Przeanalizować opinie, zdjęcia, godziny otwarcia i kompletność profilu obu firm.

        Wygeneruj profesjonalny raport w języku polskim o następującej strukturze:
        
        ### STAN OBECNY
        [Podsumuj stan wizytówki. Nadaj Health Score od 0 do 100 na początku tej sekcji w formacie "SCORE: [liczba]". Opisz braki w nienachalny, ale uświadamiający sposób.]

        ### ANALIZA LUKI RYNKOWEJ
        [Porównaj firmę z liderem w okolicy. Wskaż konkretnie, co konkurent robi lepiej (np. więcej opinii, lepsze zdjęcia, posty). Wzbudź zdrową zazdrość biznesową.]

        ### GŁOS KLIENTA
        [Analiza sentymentu opinii. Co klienci chwalą, a na co narzekają? Czego brakuje w komunikacji?]

        ### REKOMENDACJE
        [Podaj dokładnie 3 konkretne kroki naprawcze. Dla każdej rekomendacji podaj pogrubiony tytuł, a pod nim krótki akapit uzasadniający, dlaczego jest ona ważna i jak wpłynie na pozycję firmy.
        Formatuj to tak:
        1. **Tytuł**
        Opis...
        2. **Tytuł**
        Opis...
        3. **Tytuł**
        Opis...
        ]

        Styl: Perswazyjny, ekspercki, życzliwy. Używaj zwrotów: "Zauważyłem potencjał do poprawy...", "Twoi klienci szukają Cię tutaj, ale znajdują konkurencję...".
        
        Na samym końcu dodaj stopkę: "AI Apper Tomasz Możdżyński | Ekspert AI | tomasz@aiapper.com | 501453901".
      `;

      const response = await getGeminiResponse(prompt, userLocation);
      const text = response.text || "";

      // Simple parsing logic for the score and sections
      const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;

      const sections = text.split(/###\s+/);
      
      const recsRaw = sections.find(s => s.startsWith('REKOMENDACJE'))?.replace('REKOMENDACJE', '').trim() || '';
      const recsParsed: Recommendation[] = [];
      
      // Split by numbered list 1., 2., 3.
      const recItems = recsRaw.split(/\d+\.\s+/).filter(Boolean);
      recItems.forEach(item => {
        const lines = item.split('\n').filter(Boolean);
        if (lines.length >= 1) {
          const title = lines[0].replace(/\*\*/g, '').trim();
          const description = lines.slice(1).join(' ').trim();
          recsParsed.push({ title, description });
        }
      });

      setReport({
        businessName: searchQuery,
        healthScore: score,
        currentStatus: sections.find(s => s.startsWith('STAN OBECNY'))?.replace('STAN OBECNY', '').trim() || '',
        marketGap: sections.find(s => s.startsWith('ANALIZA LUKI RYNKOWEJ'))?.replace('ANALIZA LUKI RYNKOWEJ', '').trim() || '',
        customerVoice: sections.find(s => s.startsWith('GŁOS KLIENTA'))?.replace('GŁOS KLIENTA', '').trim() || '',
        recommendations: recsParsed,
        rawMarkdown: text
      });

    } catch (err: any) {
      console.error(err);
      setError("Wystąpił błąd podczas generowania audytu. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Audyt_AI_Apper_${report?.businessName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black font-sans selection:bg-black selection:text-white">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Search Section */}
        <section className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-4">
              Twój biznes zasługuje na <span className="italic serif">pierwsze miejsce</span>.
            </h2>
            <p className="text-black/60 max-w-xl mx-auto mb-8">
              Wpisz nazwę swojej firmy, a nasze AI przeanalizuje Twoją obecność w Google Maps i porówna Cię z lokalnym liderem.
            </p>

            <div className="relative max-w-2xl mx-auto group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-black/20 group-focus-within:text-black transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateAudit()}
                placeholder="Wpisz nazwę firmy i miasto..."
                className="w-full pl-12 pr-32 py-4 bg-white border border-black/10 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-lg"
              />
              <button
                onClick={generateAudit}
                disabled={loading || !searchQuery.trim()}
                className="absolute right-2 top-2 bottom-2 px-6 bg-black text-white rounded-xl font-medium hover:bg-black/80 disabled:bg-black/20 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analizuj'}
              </button>
            </div>
          </motion.div>
        </section>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-black/5 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-black rounded-full animate-spin"></div>
              </div>
              <p className="text-sm font-medium animate-pulse">Analizujemy dane z Google Maps...</p>
              <p className="text-xs text-black/40 mt-2 italic">To może potrwać do 30 sekund</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-900 mb-8"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {/* Report Section */}
        {report && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Raport Audytowy</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 hover:bg-black/5 rounded-lg transition-colors"
                  title="Drukuj"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-black/80 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Eksportuj PDF
                </button>
              </div>
            </div>

            <div 
              ref={reportRef}
              className="bg-white border border-black/5 rounded-3xl shadow-xl overflow-hidden p-8 md:p-12 space-y-12 print:shadow-none print:border-none"
            >
              {/* Report Header */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 border-b border-black/5 pb-12">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Audyt Strategiczny
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight">{report.businessName}</h1>
                  <div className="flex items-center gap-4 text-sm text-black/60">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Google Maps
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      Analiza Konkurencji
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <HealthScore score={report.healthScore} />
                </div>
              </div>

              {/* Sections */}
              <div className="grid grid-cols-1 gap-12">
                {/* Current State */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 text-black/40">
                    <FileText className="w-5 h-5" />
                    <h4 className="text-xs font-bold uppercase tracking-widest">Stan Obecny</h4>
                  </div>
                  <div className="prose prose-sm max-w-none text-black/80 leading-relaxed">
                    <Markdown>{report.currentStatus}</Markdown>
                  </div>
                </section>

                {/* Market Gap */}
                <section className="space-y-4 p-8 bg-black text-white rounded-2xl">
                  <div className="flex items-center gap-3 text-white/40">
                    <TrendingUp className="w-5 h-5" />
                    <h4 className="text-xs font-bold uppercase tracking-widest">Analiza Luki Rynkowej</h4>
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none leading-relaxed">
                    <Markdown>{report.marketGap}</Markdown>
                  </div>
                </section>

                {/* Voice of Customer */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 text-black/40">
                    <MessageSquare className="w-5 h-5" />
                    <h4 className="text-xs font-bold uppercase tracking-widest">Głos Klienta</h4>
                  </div>
                  <div className="prose prose-sm max-w-none text-black/80 leading-relaxed">
                    <Markdown>{report.customerVoice}</Markdown>
                  </div>
                </section>

                {/* Recommendations */}
                <section className="space-y-6 pt-8 border-t border-black/5">
                  <div className="flex items-center gap-3 text-black/40">
                    <CheckCircle2 className="w-5 h-5" />
                    <h4 className="text-xs font-bold uppercase tracking-widest">Rekomendacje Strategiczne</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    {report.recommendations.map((rec, i) => (
                      <div key={i} className="p-8 bg-[#F8F9FA] rounded-2xl border border-black/5 hover:border-black/20 transition-colors group">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-10 h-10 shrink-0 bg-black text-white rounded-full flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                            0{i + 1}
                          </div>
                          <h5 className="text-lg font-bold tracking-tight">{rec.title}</h5>
                        </div>
                        <p className="text-black/70 leading-relaxed pl-14">
                          {rec.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="pt-12 border-t border-black/5 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] font-bold uppercase tracking-widest text-black/40">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
                    <TrendingUp className="text-white w-3 h-3" />
                  </div>
                  AI Apper Tomasz Możdżyński
                </div>
                <div className="flex gap-6">
                  <span>tomasz@aiapper.com</span>
                  <span>501 453 901</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-black text-white p-12 rounded-3xl text-center space-y-6">
              <h3 className="text-3xl font-light">Chcesz wdrożyć te zmiany <span className="italic serif">w kilka dni</span>?</h3>
              <p className="text-white/60 max-w-lg mx-auto">
                Pomagam lokalnym biznesom zdominować wyniki wyszukiwania dzięki strategii opartej na danych i AI.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <a 
                  href="mailto:tomasz@aiapper.com" 
                  className="px-8 py-4 bg-white text-black rounded-xl font-bold hover:bg-white/90 transition-all flex items-center gap-2"
                >
                  Zamów pełne wdrożenie
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a 
                  href="tel:501453901" 
                  className="px-8 py-4 border border-white/20 rounded-xl font-bold hover:bg-white/10 transition-all"
                >
                  Zadzwoń: 501 453 901
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-black/[0.02] rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-black/[0.02] rounded-full blur-3xl"></div>
      </div>
    </div>
  );
}
