use std::collections::HashMap;

pub use hdk::prelude::*;
use holo_hash::EntryHashB64;
use branchy_integrity::{Unit, EntryTypes, LinkTypes};

use crate::error::*;
//use crate::signals::*;
use crate::tree::{UnitInfo, tree_path, _get_path_tree, PathContent, Node};

pub fn get_units_path() -> Path {
    Path::from("units")
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UnitInput {
    pub state: String,
    pub unit: Unit,
}

#[hdk_extern]
pub fn create_unit(input: UnitInput) -> ExternResult<UnitOutput> {
    Ok(create_unit_inner(input.unit, &input.state)?)
}

pub fn delete_unit_links(hash: EntryHash, tree_paths: Vec<Path>)  -> ExternResult<()> {
    let path = get_units_path();
    let anchor_hash = path.path_entry_hash()?;
    let links = get_links(anchor_hash, LinkTypes::Unit, None)?;
    let mut delete_link_input: Vec<DeleteLinkInput> = Vec::new();
    let any: AnyLinkableHash = hash.into();
    for l in links {
        if l.target == any {
            delete_link_input.push(DeleteLinkInput{
                address: l.create_link_hash,
                chain_top_ordering: ChainTopOrdering::Relaxed,
            });
        }
    }
    for path in tree_paths {
        let links = get_links(path.path_entry_hash()?, LinkTypes::Unit, None)?;
        for l in links {
            if l.target == any {
                delete_link_input.push(DeleteLinkInput{
                    address: l.create_link_hash,
                    chain_top_ordering: ChainTopOrdering::Relaxed,
                });
            }
        }
    }

    for input in delete_link_input {
        HDK.with(|hdk| hdk.borrow().delete_link(input))?;
    } 

    Ok(())
}

pub fn create_unit_links(hash: EntryHash, tree_paths: Vec<Path>, state: &str, flags: &str)  -> ExternResult<()> {
    let path = get_units_path();
    let typed_path = path.clone().into_typed(ScopedLinkType::try_from(LinkTypes::Tree)?);
    typed_path.ensure()?;

    let anchor_hash = path.path_entry_hash()?;
    let tag = LinkTag::new(String::from(format!("{}-{}", state, flags)));

    create_link(anchor_hash, hash.clone(), LinkTypes::Unit, tag.clone())?;
    for path in tree_paths {
        let typed_path = path.clone().into_typed(ScopedLinkType::try_from(LinkTypes::Tree)?);
        typed_path.ensure()?;
        create_link(path.path_entry_hash()?, hash.clone(),LinkTypes::Unit, tag.clone())?;
    }
    Ok(())
}

pub fn create_unit_inner(input: Unit, state: &str) -> ExternResult<UnitOutput> {
    let action_hash = create_entry(EntryTypes::Unitx(input.clone()))?;
    let tree_paths = input.tree_paths();
    let hash = hash_entry(&input)?;
    let maybe_record = get(action_hash, GetOptions::default())?;
    let record = maybe_record.ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
        "Could not get the record created just now"
    ))))?;
    //emit_signal(&SignalPayload::new(hash.clone().into(), Message::NewUnit(record)))?;
    create_unit_links(hash.clone(), tree_paths, state, input.flags_str())?;
    Ok(UnitOutput {
        info: UnitInfo {
            hash,
            state: state.into(),
            flags: String::from(input.flags_str()),
        },
        record,
    })
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]

pub struct UnitOutput {
    pub info: UnitInfo,
    pub record: Record,
}

///
#[hdk_extern]
fn get_units(_: ()) -> ExternResult<Vec<UnitOutput>> {
    let path = get_units_path();
    let anchor_hash = path.path_entry_hash()?;
    let units = get_units_inner(anchor_hash)?;
    Ok(units)
}

pub fn convert_tag(tag: LinkTag) -> ExternResult<(String,String)> {
    let tag_string = String::from_utf8(tag.into_inner())
    .map_err(|_e| wasm_error!(WasmErrorInner::Guest(String::from("could not convert link tag to string"))))?;
    let x : Vec<&str>= tag_string.split("-",).collect();
    if x.len() != 2 {
        return Err(wasm_error!(WasmErrorInner::Guest(format!("Badly formed link: {:?}", tag_string))));
    }
    let state = x[0].into();
    let flags: String = x[1].into();
    Ok((state,flags))
}

pub fn convert_attachment_tag(tag: LinkTag) -> ExternResult<HrlB64WithContext> {
    let attachment= HrlB64WithContext::try_from(SerializedBytes::from(UnsafeBytes::from(tag.into_inner())))
        .map_err(|_e| wasm_error!(WasmErrorInner::Guest(String::from("could not convert tag into attachment"))))?;
    Ok(attachment)
}

fn get_units_inner(base: EntryHash) -> BranchyResult<Vec<UnitOutput>> {
    let links = get_links(base, LinkTypes::Unit, None)?;

    let mut unit_infos: HashMap<EntryHash,UnitInfo> = HashMap::new();
    for link in links.clone() {
        let (state, flags) = convert_tag(link.tag.clone())?;

        let hash = EntryHash::try_from(link.target).map_err(|e| BranchyError::HashConversionError)?;
        unit_infos.insert(hash.clone(), UnitInfo {
            hash,
            state,
            flags,
        });
    }

    let mut get_input=  vec!();
    for link in links {
        if let Ok(hash) = AnyDhtHash::try_from(link.target) {
            get_input.push(GetInput::new(hash, GetOptions::default()))
        }
    }

    let unit_records = HDK.with(|hdk| hdk.borrow().get(get_input))?.into_iter()
    .filter_map(|me| me)
    .map(|record| {
        let hash = record.action().entry_hash().unwrap().clone();
        UnitOutput{
            info: unit_infos.remove(&hash).unwrap(),
            record,}
        }
     )
    .collect();
    Ok(unit_records)
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AdvanceStateInput {
    pub new_state: String,
    pub unit_hash: EntryHash,
}
#[hdk_extern]
pub fn advance_state(input: AdvanceStateInput) -> ExternResult<()> {
    let hash = EntryHash::from(input.unit_hash);
    let record = get(hash.clone(), GetOptions::default())?
         .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Unit not found"))))?;
    let unit: Unit = record
        .entry()
        .to_app_option().map_err(|err| wasm_error!(err))?

        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Malformed unit"))))?;

    
    delete_unit_links(hash.clone(), unit.tree_paths())?;

    create_unit_links(hash,unit.tree_paths(), &input.new_state, unit.flags_str())?;
    return Ok(());
}

pub type HrlB64 = (String,String);

#[derive(Clone, Serialize, Deserialize, Debug, SerializedBytes)]
#[serde(rename_all = "camelCase")]
pub struct HrlB64WithContext {
    pub hrl: HrlB64,
    pub context: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug, SerializedBytes)]
#[serde(rename_all = "camelCase")]
pub struct AddAttachmentInput {
    pub unit_hash: EntryHash,
    pub attachment: HrlB64WithContext
}
#[hdk_extern]
pub fn add_attachment(input: AddAttachmentInput) -> ExternResult<()> {
    let serialized: SerializedBytes = input.attachment.clone().try_into().map_err(|_e| wasm_error!(WasmErrorInner::Guest(String::from("could not convert attachment to tag"))))?;
    let tag :LinkTag = LinkTag::new(serialized.bytes().clone());

    let links = get_links(input.unit_hash.clone(), LinkTypes::Attachment, None)?;
    let found = links.into_iter().find(|link| link.tag == tag);
    if !found.is_some() {
        create_link(input.unit_hash.clone(), input.unit_hash, LinkTypes::Attachment, tag)?;
    }
    Ok(())
}

#[hdk_extern]
pub fn remove_attachment(input: AddAttachmentInput) -> ExternResult<()> {
    let serialized: SerializedBytes = input.attachment.clone().try_into().map_err(|_e| wasm_error!(WasmErrorInner::Guest(String::from("could not convert attachment to tag"))))?;
    let tag :LinkTag = LinkTag::new(serialized.bytes().clone());

    let links = get_links(input.unit_hash.clone(), LinkTypes::Attachment, None)?;
    for link in links {
        if link.tag == tag {
            delete_link(link.create_link_hash)?;
        }
    }
    Ok(())
}

#[hdk_extern]
pub fn get_attachments(unit_hash: EntryHash) -> ExternResult<Vec<HrlB64WithContext>> {
    let links = get_links(unit_hash, LinkTypes::Attachment, None)?;
    let mut attachments: Vec<HrlB64WithContext> = Vec::new();
    for link in links {
        attachments.push(convert_attachment_tag(link.tag)?);
    }
    Ok(attachments)
}

pub fn reparent_node(node: Node<PathContent>, from: String, to: String)-> ExternResult<()> {
    let units = node.val.units.clone();
    let current_path = node.val.path;//.clone();
    for unit in units {
        let (new_unit_output, new_unit) = reparent_unit(&unit, from.clone(), to.clone())?;
    }
    Ok(())
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUnitInput {
    pub hash: EntryHash,
    pub state: String,
    pub unit: Unit,
}
#[hdk_extern]
pub fn update_unit(input: UpdateUnitInput) -> ExternResult<UnitOutput> {
    let record = get(input.hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Unit not found"))))?;
    let old_action_hash = record.action_address().clone();
    let old_unit: Unit = record
        .entry()
        .to_app_option().map_err(|err| wasm_error!(err))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Malformed unit"))))?;

    let old_tree_paths = old_unit.tree_paths();
    let new_unit_output = _update_unit(input.hash.clone(), old_action_hash, old_tree_paths.clone(), &input.unit, &input.state)?;

    let old_path = old_unit.path_str()?;
    let new_path = input.unit.path_str()?;
    let new_parent = input.unit.parents[0].clone();
    let sub_tree = _get_path_tree(old_tree_paths[0].clone())?;
    let root = sub_tree.tree[0].clone();
    
    let reparenting = new_path != old_path || old_unit.name != input.unit.name;

    if reparenting && sub_tree.tree.len() > 1 {
        for node in sub_tree.tree.into_iter().skip(1) {
            reparent_node(node, old_path.clone(), new_path.clone())?;
        }
    };
    Ok(new_unit_output) 
}

pub fn _update_unit(hash: EntryHash, action_hash: ActionHash, paths: Vec<Path>, new_unit: &Unit, state: &str) -> ExternResult<UnitOutput> {
    delete_unit_links(hash.clone(), paths)?;
    let new_action_hash = update_entry(action_hash, new_unit)?;
    let new_unit_hash = hash_entry(new_unit)?;
    create_unit_links(new_unit_hash.clone(), new_unit.tree_paths(), state, new_unit.flags_str())?;
    let maybe_record = get(new_action_hash, GetOptions::default())?;
    let record = maybe_record.ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
        "Could not get the record created just now"
    ))))?;

    Ok(UnitOutput {
        info: UnitInfo {
            hash: new_unit_hash,
            state: state.into(),
            flags: String::from(new_unit.flags_str()),
        },
        record,
    })
}

pub fn reparent_unit(unit_info: &UnitInfo, from: String, to: String)  -> ExternResult<(UnitOutput, Unit)> {
    let record = get(unit_info.hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Unit not found"))))?;
    let mut unit: Unit = record
        .entry()
        .to_app_option().map_err(|err| wasm_error!(err))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Malformed unit"))))?;
    let old_paths = unit.tree_paths();
    if let Some(idx) = unit.parents.clone().into_iter().position(|p| {
        p.starts_with(&from)}
    ) {
        unit.parents[idx] = unit.parents[idx].replacen(&from, &to,1);
    }

    let unit_output = _update_unit(unit_info.hash.clone(),record.action_address().clone(), old_paths, &unit, &unit_info.state)?;

    Ok((unit_output,unit))
}
