use std::collections::BTreeMap;

pub use hdk::prelude::*;
pub use hdk::prelude::Path;
pub use error::{BranchyError, BranchyResult};

pub mod error;
pub mod unit;
pub mod tree;
pub mod signals;
pub mod utils;

use hdk::prelude::holo_hash::AgentPubKeyB64;
use branchy_integrity::Unit;
use unit::create_unit_inner;

#[hdk_extern]
fn init(_: ()) -> ExternResult<InitCallbackResult> {
    // grant unrestricted access to accept_cap_claim so other agents can send us claims
    let mut fns = BTreeSet::new();
    fns.insert((zome_info()?.name, "recv_remote_signal".into()));
    create_cap_grant(CapGrantEntry {
        tag: "".into(),
        // empty access converts to unrestricted
        access: ().into(),
        functions: GrantedFunctions::Listed(fns),
    })?;
    Ok(InitCallbackResult::Pass)
}
  

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Initialization {
    pub units: Vec<(String, Unit)>,
}

#[hdk_extern]
fn initialize(input: Initialization) -> ExternResult<()> {
    let mut units: BTreeMap<String, (EntryHash, String)> = BTreeMap::new();
    // add progenitor check for call
    for (state, unit) in input.units {
        let path = unit.path_str()?;
        let unit_output = create_unit_inner(unit, &state)?;
        units.insert(path, (unit_output.info.hash, state));
    };
    Ok(())
}
