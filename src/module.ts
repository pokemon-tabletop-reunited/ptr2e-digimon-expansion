// @ts-ignore - Ignore Less Error
import "./styles/index.less";
import * as R from "remeda";

declare global {
  const CONFIG: {
    Item: {
      typeLabels: Record<string, string>;
      documentClass: ConstructorOf<ItemPTR2e<foundry.abstract.TypeDataModel>>;
    }
    PTR: {
      Item: {
        dataModels: {
          species: typeof foundry.abstract.TypeDataModel;
          "ptr2e-digimon-expansion.digimonSpecies": ReturnType<typeof DigimonSpeciesFactory>;
        },
        sheetClasses: {
          "ptr2e-digimon-expansion.digimonSpecies": ReturnType<typeof DigimonSpeciesSheet>[];
          species: typeof foundry.applications.api.DocumentSheetV2[];
        }
      }
      utils: {
        SlugField: typeof foundry.data.fields.StringField;
        PredicateField: typeof foundry.data.fields.ObjectField;
        ImageResolver: typeof ImageResolver;
      }
    }
  }

  class ImageResolver {
    static createFromSpeciesData(config: ImageSpeciesResolverConfig, speciesData: SpeciesImageData): Promise<{ resolver: ImageResolver; result: string | null } | null>;
  }

  interface ImageSpeciesResolverConfig {
    /** Dex ID of mon to base search off of */
    dexId: number;
    /** Whether the target img art should be shiny */
    shiny?: boolean;
    /** Whether the target img art should be female */
    female?: boolean;
    /** Form suffix as in file path */
    forms: string[];
  }

  interface SpeciesImageData {
    data: {
      base: string;
      extensions: string[];
      random: boolean;
    }
    suffixes: Record<string, string> | null;
  }

  const game: Game<Actor<null>, Actors<Actor<null>>, ChatMessage, Combat, ItemPTR2e<foundry.abstract.TypeDataModel>, Macro, Scene, User<Actor<null>>>;

  interface Game<TActor extends Actor<null>, TActors extends Actors<TActor>, TChatMessage extends ChatMessage, TCombat extends Combat, TItem extends Item<null>, TMacro extends Macro, TScene extends Scene, TUser extends User<TActor>> {
    model: {
      Item: Record<string, unknown>;
    }
    digimon: {
      speciesPerks: Map<string, ItemPTR2e<PerkSystem>>;
    }
    ptr: {
      data: {
        artMap: Map<string, SpeciesImageData>;
      }
    }
  }

  interface Tab {
    id: string;
    group: string;
    icon: string;
    label: string;
    active?: boolean;
    cssClass?: string;
  }

  interface ItemPTR2e<T extends foundry.abstract.TypeDataModel> extends Item<null, T> {
    get slug(): string;
  }

  interface PerkSystem extends foundry.abstract.TypeDataModel {
    slug: string;
    prerequisites: Record<string, unknown>;
    cost: number;
    global: boolean;
    webs: string[];
    nodes: {
      x: number;
      y: number;
      type: "normal" | "root";
      connected: Set<string>;
    }[];
  }
}

function DigimonSpeciesFactory(base: typeof foundry.abstract.TypeDataModel) {
  class DigimonSpecies extends base {
    static override defineSchema() {
      const fields = foundry.data.fields;
      return {
        ...super.defineSchema(),
        node: new fields.SchemaField({
          x: new fields.NumberField({ required: true, nullable: true, initial: null, label: "PTR2E.FIELDS.node.x.label", hint: "PTR2E.FIELDS.node.x.hint" }),
          y: new fields.NumberField({ required: true, nullable: true, initial: null, label: "PTR2E.FIELDS.node.y.label", hint: "PTR2E.FIELDS.node.y.hint" }),
          connected: new fields.SetField(new CONFIG.PTR.utils.SlugField(), { required: true, initial: [], label: "PTR2E.FIELDS.node.connected.label", hint: "PTR2E.FIELDS.node.connected.hint" }),
          prerequisites: new CONFIG.PTR.utils.PredicateField({ label: "PTR2E.FIELDS.prerequisites.label", hint: "PTR2E.FIELDS.prerequisites.hint" }),
        })
      }
    }

    async getEvolutionPerks(isShiny = this.shiny) {
      if (game.digimon.speciesPerks.size) return Array.from(game.digimon.speciesPerks.values());

      const perks: DeepPartial<ItemPTR2e<PerkSystem>["_source"]>[] = [];
      const fromPacks = (await game.packs.get("ptr2e-digimon-expansion.digimon-species")?.getDocuments() ?? []) as ItemPTR2e<DigimonSpecies>[];
      for (const packSpecies of fromPacks) {
        if (packSpecies.type !== "ptr2e-digimon-expansion.digimonSpecies") continue;
        const node = (packSpecies.system as DigimonSpecies).node;

        const img = await (async () => {
          const config = game.ptr.data.artMap.get(packSpecies.slug);
          if (!config) return packSpecies.img ?? `systems/ptr2e/img/icons/species_icon.webp`;

          const resolver = await CONFIG.PTR.utils.ImageResolver.createFromSpeciesData({
            dexId: packSpecies.system.number,
            shiny: isShiny,
            female: false,
            forms: []
          }, config);
          return resolver?.result ?? packSpecies.img ?? `systems/ptr2e/img/icons/species_icon.webp`;
        })() as ImageFilePath;

        perks.push({
          name: `Digivolution: ${Handlebars.helpers.capitalizeFirst(packSpecies.slug)}`,
          type: "perk",
          img,
          flags: {
            ptr2e: {
              evolution: {
                name: packSpecies.slug,
                uuid: packSpecies.uuid,
              }
            }
          },
          system: {
            slug: packSpecies.slug,
            prerequisites: node.prerequisites,
            cost: 0,
            global: false,
            webs: [(this.parent as ItemPTR2e<DigimonSpecies>).uuid],
            nodes: [
              {
                x: node.x,
                y: node.y,
                type: (this.parent as ItemPTR2e<DigimonSpecies>).slug == packSpecies.slug ? "root" : "normal",
                connected: new Set<string>(Array.from(node.connected)),
              }
            ]
          }
        })
      }

      return perks.map(perkData => new CONFIG.Item.documentClass(perkData) as ItemPTR2e<PerkSystem>);
    }
  }

  interface DigimonSpecies {
    shiny: boolean;

    node: {
      x: number | null;
      y: number | null;
      connected: Set<string>;
      prerequisites: Record<string, unknown>;
    }

    number: number;
    slug: string
  }

  return DigimonSpecies
}

function DigimonSpeciesSheet(base: typeof foundry.applications.api.DocumentSheetV2) {
  return class DigimonSpeciesSheet extends base {
    static PARTS: Record<string, foundry.applications.api.HandlebarsTemplatePart> = R.omit(
      foundry.utils.mergeObject(
        //@ts-expect-error - Application V2 Compatability
        super.PARTS,
        {
          "digivolution": {
            template: "modules/ptr2e-digimon-expansion/templates/species-digivolution.hbs"
          }
        }
      ),
      ["evolution"]
    );

    tabs: Record<string, Tab> = {
      overview: {
        id: "overview",
        group: "sheet",
        icon: "fa-solid fa-house",
        label: "PTR2E.SpeciesSheet.Tabs.overview.label",
      },
      details: {
        id: "details",
        group: "sheet",
        icon: "fa-solid fa-cogs",
        label: "PTR2E.SpeciesSheet.Tabs.details.label",
      },
      digivolution: {
        id: "digivolution",
        group: "sheet",
        icon: "fa-solid fa-star",
        label: "Digimon.digivolutionLabel",
      },
      moves: {
        id: "moves",
        group: "sheet",
        icon: "fa-solid fa-burst",
        label: "PTR2E.SpeciesSheet.Tabs.moves.label",
      },
      forms: {
        id: "forms",
        group: "sheet",
        icon: "fa-solid fa-scroll",
        label: "PTR2E.SpeciesSheet.Tabs.forms.label",
      }
    };

    override _prepareSubmitData(event: SubmitEvent, form: HTMLFormElement, formData: FormDataExtended): Record<string, unknown> {
      const data = super._prepareSubmitData(event, form, formData);

      // Handle predicate processing
      data.system ??= {};
      //@ts-expect-error - Type narrowing
      data.system.node ??= {};
      //@ts-expect-error - Type narrowing
      const predicate = data.system?.node?.prerequisites;
      if(typeof predicate === "string") {
        if(predicate.trim().length === 0) {
          (data.system as {node: {prerequisites: unknown[]}}).node.prerequisites = [];
        } else {
          try {
            (data.system as {node: {prerequisites: unknown[]}}).node.prerequisites = JSON.parse(predicate);
          } catch (error) {
            if(error instanceof Error) {
              // @ts-expect-error - Missing Foundry Type
              ui.notifications.error(
                game.i18n.format("PTR2E.EffectSheet.ChangeEditor.Errors.ChangeSyntax", { message: error.message })
              )
              throw error;
            }
          }
        }
      }

      return data;
    }
  }
}

Hooks.once("init", () => {
  console.log("PTR2e Digimon Expansion | Init");

  CONFIG.PTR.Item.dataModels["ptr2e-digimon-expansion.digimonSpecies"] = DigimonSpeciesFactory(CONFIG.PTR.Item.dataModels.species);
  CONFIG.PTR.Item.sheetClasses["ptr2e-digimon-expansion.digimonSpecies"] = [DigimonSpeciesSheet(CONFIG.PTR.Item.sheetClasses.species[0])];
  //@ts-expect-error - Application V2 Compatability
  foundry.documents.collections.Items.registerSheet("ptr2e-digimon-expansion", CONFIG.PTR.Item.sheetClasses["ptr2e-digimon-expansion.digimonSpecies"][0], { types: ["ptr2e-digimon-expansion.digimonSpecies"], makeDefault: true });
})

Hooks.once("ready", () => {
  console.log("PTR2e Digimon Expansion | Ready");

  game.digimon = {
    speciesPerks: new Map<string, ItemPTR2e<PerkSystem>>(),
  }
})