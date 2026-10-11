import TextInputField, { TextInputFieldProps } from "./TextInputField";

export type DateFieldProps = Omit<TextInputFieldProps, "type">;

// Simple champ de date HTML natif (`<input type="date">`), pas de
// calendrier custom : aucune librairie de calendrier (react-day-picker ou
// équivalent) n'était installée dans le projet et l'input natif couvre déjà
// le besoin (sélecteur du navigateur, format ISO `YYYY-MM-DD` cohérent avec
// ce que l'API attend). À réévaluer si un vrai composant calendrier devient
// nécessaire (plage de dates, jours désactivés, etc.).
export default function DateField(props: DateFieldProps) {
  return <TextInputField {...props} type="date" />;
}
