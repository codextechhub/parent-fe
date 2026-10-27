const TITLE = /^(mr|mrs|miss|ms|mx|dr|prof|engr|chief)\.?$/i;

/**
 * The letters for the round mark beside a teacher: the first two words past
 * any title ("Funke Okoro" from "Mrs Funke Okoro"), or the title's letter and
 * the name's where one word is all there is past it ("MO" for "Mr. Okafor"),
 * as the design draws them.
 */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
  const named = words.filter((word) => !TITLE.test(word));
  const picked = named.length >= 2 ? named : words;
  return picked.slice(0, 2).map((word) => Array.from(word)[0]).join("").toUpperCase() || "?";
}
