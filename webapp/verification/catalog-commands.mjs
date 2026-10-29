import { games } from '../src/games/registry.js';
// Prints reviewable admin commands; never changes any database.
for(const g of games)console.log(`python3 backend/database/manage-game.py create --id ${g.id} --name '${g.name}' --unit ${g.score_unit} --direction ${g.ranking_direction} --min ${g.min_value} --max ${g.max_value}`);
