use hdi::prelude::*;
use hdi::hash_path::path::{Component, Path};
use std::collections::BTreeMap;
use holo_hash::AgentPubKeyB64;


pub const TREE_ROOT:&str = "T";

#[hdk_entry_helper]
#[serde(rename_all = "camelCase")]
#[derive(Clone)]
pub struct Unit {
    pub parents: Vec<String>, // full paths to parent nodes (remember it's a DAG)
    pub description: String,
    pub name: String, // max 10 char
    pub stewards: Vec<AgentPubKeyB64>,  // people who can change this document
    pub meta: BTreeMap<String, String>, // for UI to do things    pub name: String,
}

impl Unit {
    pub fn flags_str(&self) -> &str {
        match self.meta.get("flags") {
            Some(flags) => flags,
            None => "",
        }
    } 
    pub fn path_str(&self) -> ExternResult<String> {
        let x = self.tree_paths();
        let v = x[0].as_ref();
        if v.len() == 0 {
            return Ok(String::from(""))
        }
        let mut seg: Vec<String> = Vec::new();
        let mut i = 1;
        while i < v.len() {
            seg.push(String::try_from(&v[i]).map_err(|e| wasm_error!(e))?);
            i = i + 1;
        }
        Ok(seg.join("."))
    }
    pub fn tree_paths(&self) -> Vec<Path> {
        let mut paths = Vec::new();
        for parent in &self.parents {
            let mut path = Vec::new();
            path.push(Component::from(TREE_ROOT));
            for c in Path::from(parent).as_ref().into_iter() {
                path.push(c.clone());
            }
            path.push(Component::from(&self.name));
            paths.push(Path::from(path));
        };
        if paths.len() == 0 {
            let mut path = Vec::new();
            path.push(Component::from(TREE_ROOT));
            if self.name != "" {
                path.push(Component::from(&self.name));
            }
            paths.push(Path::from(path));
        }
        paths
    }
}

#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(required_validations = 5)]
    Unitx(Unit), 
}

#[hdk_link_types]
pub enum LinkTypes {
    Unit,
    Tree,
    Mark,
    Attachment,
}

#[hdk_extern]
pub fn validate(_op: Op) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

