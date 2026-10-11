import { useEffect, useMemo, useState } from "react";


export interface KnownEvaluation {
  label: string;
  weight: number;
}

export interface GradeLike {
  studentId: string;
  evaluations: { label: string; weight: number | string; value: number | string }[];
}

export interface UseEvaluationSelectionParams {
  groupeId: string;
  subjectId: string;
  trimestre: number;
  ready: boolean;
  gradesLoading: boolean;
  gradesData: GradeLike[] | undefined;
  defaultWeight?: string;
}

export interface UseEvaluationSelectionResult {
  knownEvaluations: KnownEvaluation[];
  selectedLabel: string | null;
  setSelectedLabel: (label: string | null) => void;
  labelInput: string;
  setLabelInput: (value: string) => void;
  weightInput: string;
  setWeightInput: (value: string) => void;
  activeLabel: string;
  activeWeight: number;
  /** `selectedLabel` est une évaluation EXISTANTE sélectionnée (ni null, ni ""). */
  isExistingEvaluation: boolean;
  /** Poids d'origine de l'évaluation existante sélectionnée, avant toute édition dans ce formulaire. */
  originalWeight: number | null;
  /** true si l'utilisateur a modifié le poids d'une évaluation EXISTANTE (pas une nouvelle). */
  weightChanged: boolean;
}

export function useEvaluationSelection({
  groupeId,
  subjectId,
  trimestre,
  ready,
  gradesLoading,
  gradesData,
  defaultWeight = "25",
}: UseEvaluationSelectionParams): UseEvaluationSelectionResult {
  // Évaluations déjà connues pour cette combinaison classe/matière/trimestre
  // (libellés distincts, dans l'ordre où ils apparaissent chez les élèves).
  const knownEvaluations = useMemo<KnownEvaluation[]>(() => {
    const seen = new Map<string, number>();
    for (const grade of gradesData ?? []) {
      for (const ev of grade.evaluations) {
        if (!seen.has(ev.label)) seen.set(ev.label, Number(ev.weight));
      }
    }
    return [...seen.entries()].map(([label, weight]) => ({ label, weight }));
  }, [gradesData]);

  // `null` = pas encore décidé (on attend les données pour choisir un
  // défaut raisonnable) ; `""` = l'utilisateur crée une NOUVELLE évaluation ;
  // toute autre valeur = le libellé d'une évaluation existante sélectionnée.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [weightInput, setWeightInput] = useState(defaultWeight);

  // Remise à zéro complète dès que la combinaison classe/matière/trimestre
  // change : on ne garde jamais la sélection d'une autre combinaison.
  useEffect(() => {
    setSelectedLabel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupeId, subjectId, trimestre]);

  // Choix par défaut une fois les données chargées : la première évaluation
  // existante s'il y en a, sinon on bascule directement en mode "nouvelle
  // évaluation" (il n'y a rien à sélectionner).
  useEffect(() => {
    if (selectedLabel !== null) return;
    if (!ready || gradesLoading) return;
    setSelectedLabel(knownEvaluations.length > 0 ? knownEvaluations[0].label : "");
  }, [selectedLabel, ready, gradesLoading, knownEvaluations]);

  // Prépare le libellé/poids affichés à chaque changement RÉEL de sélection
  // (pas à chaque refetch) : en mode "nouvelle évaluation", champs vides et
  // poids par défaut ; en mode "évaluation existante", poids repris de la
  // première valeur trouvée (éditable : une correction de poids s'applique
  // à toute la classe au prochain enregistrement).
  useEffect(() => {
    if (selectedLabel === null) return;
    if (selectedLabel === "") {
      setLabelInput("");
      setWeightInput(defaultWeight);
    } else {
      const known = knownEvaluations.find((e) => e.label === selectedLabel);
      setWeightInput(known ? String(known.weight) : defaultWeight);
    }
    // Intentionally omitting `knownEvaluations` from deps: this effect should
    // only reset the label/weight fields when the user switches which
    // evaluation is selected, not every time the grades query refetches (that
    // recomputes `knownEvaluations` and would blow away weight edits still in
    // progress).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabel, defaultWeight]);

  const activeLabel = selectedLabel === "" ? labelInput.trim() : selectedLabel ?? "";
  const activeWeight = Number(weightInput) || 0;
  const isExistingEvaluation = Boolean(selectedLabel);

  const originalWeight = useMemo(() => {
    if (!isExistingEvaluation) return null;
    const known = knownEvaluations.find((e) => e.label === selectedLabel);
    return known ? known.weight : null;
  }, [isExistingEvaluation, knownEvaluations, selectedLabel]);

  const weightChanged = isExistingEvaluation && originalWeight !== null && activeWeight !== originalWeight;

  return {
    knownEvaluations,
    selectedLabel,
    setSelectedLabel,
    labelInput,
    setLabelInput,
    weightInput,
    setWeightInput,
    activeLabel,
    activeWeight,
    isExistingEvaluation,
    originalWeight,
    weightChanged,
  };
}
