import { games } from '../src/games/registry.js';
// Prints reviewable admin commands; never changes any database.
const family=process.argv.find(arg=>arg.startsWith('--family='))?.slice(9);
if(family&&!games.some(game=>game.key===family))throw new Error('Ukjent spillfamilie.');
for(const g of games.filter(game=>!family||game.key===family))console.log(`python3 backend/database/manage-game.py create --id ${g.id} --name '${g.name}' --unit ${g.score_unit} --direction ${g.ranking_direction} --min ${g.min_value} --max ${g.max_value}`);
